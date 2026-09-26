using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;

namespace VgschArm;

/// <summary>
/// Автообновление: программа спрашивает сервер, нет ли версии новее,
/// и если есть — предлагает дежурному скачать и поставить её.
/// Сервер недоступен (нет интернета на рабочем месте) — тихо работаем дальше.
/// </summary>
public static class Updater
{
    // Адрес сервиса обновлений. Подставляется при сборке из update_url.txt
    private static string ApiUrl
    {
        get
        {
            string f = Path.Combine(AppContext.BaseDirectory, "update_url.txt");
            return File.Exists(f) ? File.ReadAllText(f).Trim() : "";
        }
    }

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };

    public sealed class UpdateInfo
    {
        public bool UpdateAvailable { get; set; }
        public string Version { get; set; } = "";
        public string FileName { get; set; } = "";
        public string FileUrl { get; set; } = "";
        public long FileSize { get; set; }
        public string Sha256 { get; set; } = "";
        public string Notes { get; set; } = "";
        public bool Mandatory { get; set; }
    }

    public static async Task<UpdateInfo?> CheckAsync(string currentVersion)
    {
        string api = ApiUrl;
        if (string.IsNullOrWhiteSpace(api)) return null;

        try
        {
            string url = $"{api}?action=check&version={Uri.EscapeDataString(currentVersion)}";
            string json = await Http.GetStringAsync(url);

            var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var info = JsonSerializer.Deserialize<UpdateInfo>(json, opts);
            return info is { UpdateAvailable: true } ? info : null;
        }
        catch
        {
            // Нет связи с сервером — это штатная ситуация на изолированном АРМ
            return null;
        }
    }

    /// <summary>Скачивает установщик, проверяет контрольную сумму и запускает его.</summary>
    public static async Task<bool> DownloadAndRunAsync(UpdateInfo info, IProgress<int> progress, CancellationToken ct)
    {
        string dir = Path.Combine(Path.GetTempPath(), "VGSCH-ARM-update");
        Directory.CreateDirectory(dir);
        string target = Path.Combine(dir, info.FileName);

        using (var resp = await Http.GetAsync(info.FileUrl, HttpCompletionOption.ResponseHeadersRead, ct))
        {
            resp.EnsureSuccessStatusCode();
            long total = resp.Content.Headers.ContentLength ?? info.FileSize;

            await using var src = await resp.Content.ReadAsStreamAsync(ct);
            await using var dst = File.Create(target);

            byte[] buf = new byte[81920];
            long done = 0;
            int read;
            while ((read = await src.ReadAsync(buf, ct)) > 0)
            {
                await dst.WriteAsync(buf.AsMemory(0, read), ct);
                done += read;
                if (total > 0) progress.Report((int)(done * 100 / total));
            }
        }

        // Контрольная сумма: защищает от битой загрузки и подмены файла
        if (!string.IsNullOrEmpty(info.Sha256))
        {
            await using var fs = File.OpenRead(target);
            byte[] hash = await SHA256.HashDataAsync(fs, ct);
            string got = Convert.ToHexString(hash).ToLowerInvariant();
            if (got != info.Sha256.ToLowerInvariant())
            {
                try { File.Delete(target); } catch { }
                throw new InvalidOperationException(
                    "Файл обновления повреждён при загрузке. Попробуйте ещё раз.");
            }
        }

        // Установщик сам закроет программу и обновит файлы
        Process.Start(new ProcessStartInfo
        {
            FileName = target,
            UseShellExecute = true,
        });

        return true;
    }

    /// <summary>Отметить факт установки — для статистики в разделе «Сборка».</summary>
    public static async Task CountDownloadAsync(string version)
    {
        string api = ApiUrl;
        if (string.IsNullOrWhiteSpace(api)) return;
        try
        {
            await Http.PostAsync($"{api}?action=download&version={Uri.EscapeDataString(version)}", null);
        }
        catch { }
    }
}
