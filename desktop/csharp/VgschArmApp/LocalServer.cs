using System.Net;
using System.Text;

namespace VgschArm;

/// <summary>
/// Локальный HTTP-сервер: раздаёт файлы интерфейса из папки web\.
/// Нужен потому, что SPA (React Router, localStorage, fetch) корректно
/// работает только по http://, а не по file://.
/// </summary>
public sealed class LocalServer : IDisposable
{
    private readonly HttpListener _listener = new();
    private readonly string _root;
    private CancellationTokenSource? _cts;

    public int Port { get; private set; }
    public string BaseUrl => $"http://127.0.0.1:{Port}/";

    private static readonly Dictionary<string, string> Mime = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8",
        [".js"] = "text/javascript; charset=utf-8",
        [".mjs"] = "text/javascript; charset=utf-8",
        [".css"] = "text/css; charset=utf-8",
        [".json"] = "application/json; charset=utf-8",
        [".webmanifest"] = "application/manifest+json; charset=utf-8",
        [".svg"] = "image/svg+xml",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".ico"] = "image/x-icon",
        [".webp"] = "image/webp",
        [".woff"] = "font/woff",
        [".woff2"] = "font/woff2",
        [".ttf"] = "font/ttf",
        [".map"] = "application/json; charset=utf-8",
        [".txt"] = "text/plain; charset=utf-8",
        [".mp3"] = "audio/mpeg",
        [".wav"] = "audio/wav",
    };

    public LocalServer(string webRoot)
    {
        _root = Path.GetFullPath(webRoot);
    }

    public void Start()
    {
        Port = FindFreePort();
        _listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
        _listener.Start();
        _cts = new CancellationTokenSource();
        _ = Task.Run(() => LoopAsync(_cts.Token));
    }

    private static int FindFreePort()
    {
        var l = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0);
        l.Start();
        int port = ((IPEndPoint)l.LocalEndpoint).Port;
        l.Stop();
        return port;
    }

    private async Task LoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            HttpListenerContext ctx;
            try { ctx = await _listener.GetContextAsync(); }
            catch { break; }

            _ = Task.Run(() => Handle(ctx));
        }
    }

    private void Handle(HttpListenerContext ctx)
    {
        try
        {
            string path = Uri.UnescapeDataString(ctx.Request.Url?.AbsolutePath ?? "/").TrimStart('/');
            if (string.IsNullOrEmpty(path)) path = "index.html";

            string full = Path.GetFullPath(Path.Combine(_root, path.Replace('/', Path.DirectorySeparatorChar)));

            // Защита от выхода за пределы web\
            if (!full.StartsWith(_root, StringComparison.OrdinalIgnoreCase))
                full = Path.Combine(_root, "index.html");

            // SPA fallback: любой неизвестный маршрут отдаёт index.html
            if (!File.Exists(full))
                full = Path.Combine(_root, "index.html");

            if (!File.Exists(full))
            {
                ctx.Response.StatusCode = 404;
                byte[] nf = Encoding.UTF8.GetBytes("Interface files not found");
                ctx.Response.OutputStream.Write(nf, 0, nf.Length);
                ctx.Response.Close();
                return;
            }

            string ext = Path.GetExtension(full);
            ctx.Response.ContentType = Mime.TryGetValue(ext, out var m) ? m : "application/octet-stream";
            ctx.Response.Headers["Cache-Control"] = "no-store";

            byte[] data = File.ReadAllBytes(full);
            ctx.Response.ContentLength64 = data.Length;
            ctx.Response.OutputStream.Write(data, 0, data.Length);
            ctx.Response.Close();
        }
        catch
        {
            try { ctx.Response.Abort(); } catch { }
        }
    }

    public void Dispose()
    {
        try { _cts?.Cancel(); } catch { }
        try { _listener.Stop(); } catch { }
        try { _listener.Close(); } catch { }
    }
}
