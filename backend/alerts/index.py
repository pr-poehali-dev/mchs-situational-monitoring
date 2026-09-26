import json
import os
import re
import secrets
from typing import Any, Dict, List

import psycopg2
import requests

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
}


def _json(status: int, body: Any) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'isBase64Encoded': False,
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }


def _db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _esc(s: str) -> str:
    return str(s).replace("'", "''")


def _phone(raw: str) -> str:
    """Приводит телефон к виду 79120000000 — как ждут шлюзы."""
    d = re.sub(r'\D', '', raw or '')
    if len(d) == 11 and d.startswith('8'):
        d = '7' + d[1:]
    if len(d) == 10:
        d = '7' + d
    return d if len(d) == 11 and d.startswith('7') else ''


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Оповещение личного состава при аварии: рассылка по MAX, SMS и голосовым звонкам, сбор подтверждений."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if method == 'POST' and action == 'declare':
        return _declare(event)
    if method == 'POST' and action == 'close':
        return _close(event)
    if method == 'POST' and action == 'confirm':
        return _confirm(params)
    if method == 'GET' and action == 'status':
        return _status(params)
    if method == 'GET' and action == 'channels':
        return _channels()
    if method == 'GET':
        return _active()

    return _json(405, {'error': 'Метод не поддерживается'})


def _channels() -> Dict[str, Any]:
    """Какие каналы оповещения настроены — АРМ показывает это дежурному."""
    return _json(200, {
        'max': bool(os.environ.get('MAX_BOT_TOKEN') and os.environ.get('MAX_CHAT_ID')),
        'sms': bool(os.environ.get('SMSRU_API_ID')),
        'call': bool(os.environ.get('ZVONOK_API_KEY') and os.environ.get('ZVONOK_CAMPAIGN_ID')),
    })


def _declare(event) -> Dict[str, Any]:
    body = json.loads(event.get('body') or '{}')

    label = (body.get('accidentLabel') or 'АВАРИЯ').strip()
    atype = (body.get('accidentType') or '').strip()
    opo = (body.get('opo') or '').strip()
    location = (body.get('location') or '').strip()
    started = (body.get('startedAt') or '').strip()
    declared_by = (body.get('declaredBy') or 'Дежурный').strip()
    recipients: List[dict] = body.get('recipients') or []
    channels: List[str] = body.get('channels') or ['max', 'sms', 'call']

    if not recipients:
        return _json(400, {'error': 'Не выбран ни один получатель'})

    base_url = (body.get('baseUrl') or '').rstrip('/')

    text = _build_text(label, opo, location, started)

    with _db() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO alerts (accident_type, accident_label, opo, location, "
            "started_at, declared_by, channels, total_recipients) VALUES "
            f"('{_esc(atype)}', '{_esc(label)}', '{_esc(opo)}', '{_esc(location)}', "
            f"'{_esc(started)}', '{_esc(declared_by)}', '{_esc(','.join(channels))}', "
            f"{len(recipients)}) RETURNING id"
        )
        alert_id = cur.fetchone()[0]

        rows = []
        for p in recipients:
            token = secrets.token_urlsafe(9)
            name = (p.get('name') or '').strip()
            rank = (p.get('rank') or '').strip()
            phone = _phone(p.get('phone') or '')
            pid = (p.get('id') or '').strip()
            cur.execute(
                "INSERT INTO alert_recipients (alert_id, person_id, name, rank, phone, token) "
                f"VALUES ({alert_id}, '{_esc(pid)}', '{_esc(name)}', '{_esc(rank)}', "
                f"'{_esc(phone)}', '{token}') RETURNING id"
            )
            rows.append({'rid': cur.fetchone()[0], 'name': name, 'phone': phone, 'token': token})
        conn.commit()

    result = {'max': None, 'sms': [], 'call': []}

    if 'max' in channels:
        result['max'] = _send_max(text, rows, base_url, alert_id)

    if 'sms' in channels:
        result['sms'] = _send_sms(label, opo, location, rows, base_url)

    if 'call' in channels:
        result['call'] = _make_calls(rows)

    _save_statuses(alert_id, result)

    return _json(200, {
        'ok': True,
        'alertId': alert_id,
        'recipients': len(rows),
        'result': result,
    })


def _build_text(label: str, opo: str, location: str, started: str) -> str:
    lines = [f'🚨 АВАРИЯ — {label}']
    if opo:
        lines.append(f'Объект: {opo}')
    if location:
        lines.append(f'Место: {location}')
    if started:
        lines.append(f'Время вызова: {started}')
    lines.append('')
    lines.append('Личному составу — явиться в расположение.')
    return '\n'.join(lines)


def _send_max(text: str, rows: List[dict], base_url: str, alert_id: int):
    token = os.environ.get('MAX_BOT_TOKEN')
    chat_id = os.environ.get('MAX_CHAT_ID')
    if not (token and chat_id):
        return {'ok': False, 'error': 'MAX не настроен'}

    msg = text
    if base_url:
        msg += f'\n\nПодтвердить вызов: {base_url}/alert?a={alert_id}'

    try:
        r = requests.post(
            'https://platform-api.max.ru/messages',
            params={'access_token': token, 'chat_id': chat_id},
            json={'text': msg},
            timeout=10,
        )
        if r.status_code >= 400:
            return {'ok': False, 'error': f'MAX: {r.status_code} {r.text[:200]}'}
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': f'MAX: {str(e)[:200]}'}


def _send_sms(label: str, opo: str, location: str, rows: List[dict], base_url: str):
    api_id = os.environ.get('SMSRU_API_ID')
    out = []
    if not api_id:
        return [{'rid': r['rid'], 'ok': False, 'error': 'SMS не настроен'} for r in rows]

    place = ', '.join(x for x in [opo, location] if x)
    for r in rows:
        if not r['phone']:
            out.append({'rid': r['rid'], 'ok': False, 'error': 'нет телефона'})
            continue

        msg = f'AVARIYA: {label}. {place}. Yavitsya v raspolozhenie.'
        if base_url:
            msg += f' Podtverdit: {base_url}/a/{r["token"]}'

        try:
            resp = requests.get(
                'https://sms.ru/sms/send',
                params={'api_id': api_id, 'to': r['phone'], 'msg': msg, 'json': 1},
                timeout=10,
            )
            d = resp.json()
            st = (d.get('sms') or {}).get(r['phone'], {})
            if d.get('status') == 'OK' and st.get('status') == 'OK':
                out.append({'rid': r['rid'], 'ok': True})
            else:
                out.append({'rid': r['rid'], 'ok': False,
                            'error': str(st.get('status_text') or d.get('status_text'))[:200]})
        except Exception as e:
            out.append({'rid': r['rid'], 'ok': False, 'error': str(e)[:200]})

    return out


def _make_calls(rows: List[dict]):
    key = os.environ.get('ZVONOK_API_KEY')
    campaign = os.environ.get('ZVONOK_CAMPAIGN_ID')
    out = []
    if not (key and campaign):
        return [{'rid': r['rid'], 'ok': False, 'error': 'Обзвон не настроен'} for r in rows]

    for r in rows:
        if not r['phone']:
            out.append({'rid': r['rid'], 'ok': False, 'error': 'нет телефона'})
            continue
        try:
            resp = requests.post(
                'https://zvonok.com/manager/cabapi_external/api/v1/phones/call/',
                data={
                    'public_key': key,
                    'campaign_id': campaign,
                    'phone': '+' + r['phone'],
                    'text': r['name'],
                },
                timeout=12,
            )
            d = resp.json()
            if str(d.get('status')).lower() in ('ok', 'success'):
                out.append({'rid': r['rid'], 'ok': True})
            else:
                out.append({'rid': r['rid'], 'ok': False, 'error': str(d)[:200]})
        except Exception as e:
            out.append({'rid': r['rid'], 'ok': False, 'error': str(e)[:200]})

    return out


def _save_statuses(alert_id: int, result: dict):
    with _db() as conn, conn.cursor() as cur:
        for item in result.get('sms') or []:
            st = 'sent' if item['ok'] else 'failed'
            err = _esc(item.get('error', ''))
            cur.execute(
                f"UPDATE alert_recipients SET sms_status = '{st}', sms_error = '{err}' "
                f"WHERE id = {item['rid']}"
            )
        for item in result.get('call') or []:
            st = 'sent' if item['ok'] else 'failed'
            err = _esc(item.get('error', ''))
            cur.execute(
                f"UPDATE alert_recipients SET call_status = '{st}', call_error = '{err}' "
                f"WHERE id = {item['rid']}"
            )
        conn.commit()


def _confirm(params) -> Dict[str, Any]:
    token = (params.get('token') or '').strip()
    via = (params.get('via') or 'link').strip()[:20]
    if not token or len(token) > 40:
        return _json(400, {'error': 'Неверная ссылка подтверждения'})

    with _db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT r.id, r.alert_id, r.name, r.confirmed, a.active, a.accident_label, a.opo, a.location "
            f"FROM alert_recipients r JOIN alerts a ON a.id = r.alert_id WHERE r.token = '{_esc(token)}'"
        )
        row = cur.fetchone()
        if not row:
            return _json(404, {'error': 'Вызов не найден или устарел'})

        rid, aid, name, already, active, label, opo, location = row

        if not already:
            cur.execute(
                f"UPDATE alert_recipients SET confirmed = TRUE, confirmed_at = NOW(), "
                f"confirmed_via = '{_esc(via)}' WHERE id = {rid}"
            )
            cur.execute(
                "UPDATE alerts SET confirmed_count = (SELECT COUNT(*) FROM alert_recipients "
                f"WHERE alert_id = {aid} AND confirmed = TRUE) WHERE id = {aid}"
            )
            conn.commit()

    return _json(200, {
        'ok': True, 'name': name, 'alreadyConfirmed': already, 'accidentActive': active,
        'accidentLabel': label, 'opo': opo, 'location': location,
    })


def _status(params) -> Dict[str, Any]:
    aid = params.get('alertId')
    with _db() as conn, conn.cursor() as cur:
        if aid and str(aid).isdigit():
            cur.execute(f"SELECT id FROM alerts WHERE id = {int(aid)}")
        else:
            cur.execute("SELECT id FROM alerts WHERE active = TRUE ORDER BY created_at DESC LIMIT 1")
        row = cur.fetchone()
        if not row:
            return _json(200, {'alert': None, 'recipients': []})
        alert_id = row[0]

        cur.execute(
            "SELECT id, accident_label, opo, location, started_at, declared_by, channels, "
            "total_recipients, confirmed_count, active, created_at "
            f"FROM alerts WHERE id = {alert_id}"
        )
        a = cur.fetchone()

        cur.execute(
            "SELECT id, name, rank, phone, sms_status, sms_error, call_status, call_error, "
            "confirmed, confirmed_at, confirmed_via "
            f"FROM alert_recipients WHERE alert_id = {alert_id} ORDER BY confirmed DESC, name"
        )
        rs = cur.fetchall()

    return _json(200, {
        'alert': {
            'id': a[0], 'label': a[1], 'opo': a[2], 'location': a[3], 'startedAt': a[4],
            'declaredBy': a[5], 'channels': a[6].split(',') if a[6] else [],
            'total': a[7], 'confirmed': a[8], 'active': a[9], 'createdAt': a[10].isoformat(),
        },
        'recipients': [{
            'id': r[0], 'name': r[1], 'rank': r[2], 'phone': r[3],
            'smsStatus': r[4], 'smsError': r[5], 'callStatus': r[6], 'callError': r[7],
            'confirmed': r[8], 'confirmedAt': r[9].isoformat() if r[9] else None,
            'confirmedVia': r[10],
        } for r in rs],
    })


def _active() -> Dict[str, Any]:
    with _db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, accident_label, opo, total_recipients, confirmed_count, created_at "
            "FROM alerts WHERE active = TRUE ORDER BY created_at DESC LIMIT 1"
        )
        r = cur.fetchone()

    if not r:
        return _json(200, {'alert': None})
    return _json(200, {'alert': {
        'id': r[0], 'label': r[1], 'opo': r[2],
        'total': r[3], 'confirmed': r[4], 'createdAt': r[5].isoformat(),
    }})


def _close(event) -> Dict[str, Any]:
    body = json.loads(event.get('body') or '{}')
    aid = body.get('alertId')

    with _db() as conn, conn.cursor() as cur:
        if aid and str(aid).isdigit():
            cur.execute(f"UPDATE alerts SET active = FALSE, closed_at = NOW() WHERE id = {int(aid)}")
        else:
            cur.execute("UPDATE alerts SET active = FALSE, closed_at = NOW() WHERE active = TRUE")
        conn.commit()

    token = os.environ.get('MAX_BOT_TOKEN')
    chat_id = os.environ.get('MAX_CHAT_ID')
    if token and chat_id:
        try:
            requests.post(
                'https://platform-api.max.ru/messages',
                params={'access_token': token, 'chat_id': chat_id},
                json={'text': '✅ ОТБОЙ АВАРИИ. Горноспасательные работы завершены.'},
                timeout=10,
            )
        except Exception:
            pass

    return _json(200, {'ok': True})
