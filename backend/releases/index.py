import base64
import hashlib
import json
import os
import re
from typing import Any, Dict

import boto3
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
}

VERSION_RE = re.compile(r'^\d+\.\d+\.\d+$')


def _json(status: int, body: Any) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'isBase64Encoded': False,
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }


def _db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _vkey(v: str):
    try:
        return tuple(int(x) for x in v.split('.'))
    except Exception:
        return (0, 0, 0)


def _admin_ok(event) -> bool:
    expected = os.environ.get('ADMIN_TOKEN', '')
    if not expected:
        return False
    headers = event.get('headers') or {}
    got = headers.get('X-Admin-Token') or headers.get('x-admin-token') or ''
    return got == expected


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Обновления АРМ Дежурного: публикация новых версий и проверка наличия обновления программой."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if method == 'GET' and action == 'check':
        return _check(params)
    if method == 'GET':
        return _list()
    if method == 'POST' and action == 'download':
        return _count_download(params)
    if method == 'POST':
        return _publish(event)
    if method == 'DELETE':
        return _delete(event, params)

    return _json(405, {'error': 'Метод не поддерживается'})


def _list() -> Dict[str, Any]:
    with _db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, version, file_name, file_url, file_size, sha256, notes, "
            "mandatory, published, downloads, created_at FROM app_releases "
            "ORDER BY created_at DESC LIMIT 50"
        )
        rows = cur.fetchall()

    items = [{
        'id': r[0], 'version': r[1], 'fileName': r[2], 'fileUrl': r[3],
        'fileSize': int(r[4]), 'sha256': r[5], 'notes': r[6],
        'mandatory': r[7], 'published': r[8], 'downloads': r[9],
        'createdAt': r[10].isoformat(),
    } for r in rows]

    return _json(200, {'releases': items})


def _check(params) -> Dict[str, Any]:
    current = (params.get('version') or '0.0.0').strip()

    with _db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT version, file_name, file_url, file_size, sha256, notes, mandatory "
            "FROM app_releases WHERE published = TRUE ORDER BY created_at DESC LIMIT 30"
        )
        rows = cur.fetchall()

    if not rows:
        return _json(200, {'updateAvailable': False, 'currentVersion': current})

    newest = max(rows, key=lambda r: _vkey(r[0]))

    if _vkey(newest[0]) <= _vkey(current):
        return _json(200, {'updateAvailable': False, 'currentVersion': current})

    return _json(200, {
        'updateAvailable': True,
        'currentVersion': current,
        'version': newest[0],
        'fileName': newest[1],
        'fileUrl': newest[2],
        'fileSize': int(newest[3]),
        'sha256': newest[4],
        'notes': newest[5],
        'mandatory': newest[6],
    })


def _publish(event) -> Dict[str, Any]:
    if not _admin_ok(event):
        return _json(403, {'error': 'Нет доступа — неверный код администратора'})

    body = json.loads(event.get('body') or '{}')
    version = (body.get('version') or '').strip()
    notes = (body.get('notes') or '').strip()
    mandatory = bool(body.get('mandatory'))
    file_name = (body.get('fileName') or f'VGSCH-ARM-Setup-{version}.exe').strip()
    file_b64 = body.get('fileBase64') or ''

    if not VERSION_RE.match(version):
        return _json(400, {'error': 'Версия должна быть в формате 1.0.0'})
    if not file_b64:
        return _json(400, {'error': 'Не приложен файл установщика'})

    if ',' in file_b64[:100] and file_b64.startswith('data:'):
        file_b64 = file_b64.split(',', 1)[1]

    data = base64.b64decode(file_b64)
    if len(data) < 1024:
        return _json(400, {'error': 'Файл установщика слишком маленький'})

    sha256 = hashlib.sha256(data).hexdigest()

    key_id = os.environ['AWS_ACCESS_KEY_ID']
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=key_id,
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    key = f'releases/{version}/{file_name}'
    s3.put_object(Bucket='files', Key=key, Body=data,
                  ContentType='application/vnd.microsoft.portable-executable')

    file_url = f'https://cdn.poehali.dev/projects/{key_id}/bucket/{key}'

    with _db() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO app_releases (version, file_name, file_url, file_size, sha256, notes, mandatory) "
            f"VALUES ('{version}', '{file_name}', '{file_url}', {len(data)}, '{sha256}', "
            f"'{notes.replace(chr(39), chr(39) * 2)}', {'TRUE' if mandatory else 'FALSE'}) "
            "ON CONFLICT (version) DO UPDATE SET "
            "file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, "
            "file_size = EXCLUDED.file_size, sha256 = EXCLUDED.sha256, "
            "notes = EXCLUDED.notes, mandatory = EXCLUDED.mandatory, "
            "published = TRUE, created_at = NOW() RETURNING id"
        )
        rid = cur.fetchone()[0]
        conn.commit()

    return _json(200, {
        'ok': True, 'id': rid, 'version': version,
        'fileUrl': file_url, 'fileSize': len(data), 'sha256': sha256,
    })


def _delete(event, params) -> Dict[str, Any]:
    if not _admin_ok(event):
        return _json(403, {'error': 'Нет доступа — неверный код администратора'})

    version = (params.get('version') or '').strip()
    if not VERSION_RE.match(version):
        return _json(400, {'error': 'Не указана версия'})

    with _db() as conn, conn.cursor() as cur:
        cur.execute(f"DELETE FROM app_releases WHERE version = '{version}'")
        conn.commit()

    return _json(200, {'ok': True})


def _count_download(params) -> Dict[str, Any]:
    version = (params.get('version') or '').strip()
    if not VERSION_RE.match(version):
        return _json(400, {'error': 'Не указана версия'})

    with _db() as conn, conn.cursor() as cur:
        cur.execute(f"UPDATE app_releases SET downloads = downloads + 1 WHERE version = '{version}'")
        conn.commit()

    return _json(200, {'ok': True})
