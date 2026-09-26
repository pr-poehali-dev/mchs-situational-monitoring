using System.Diagnostics;

namespace VgschArm;

internal static class Program
{
    private const string MutexName = "Global\\VGSCH-ARM-SingleInstance";

    [STAThread]
    private static void Main()
    {
        // Один дежурный — одна программа. Второй запуск только путает.
        using var mutex = new Mutex(true, MutexName, out bool isFirst);
        if (!isFirst)
        {
            MessageBox.Show("АРМ Дежурного ВГСЧ уже запущен.",
                "АРМ Дежурного ВГСЧ", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);

        string baseDir = AppContext.BaseDirectory;
        string webRoot = Path.Combine(baseDir, "web");

        if (!File.Exists(Path.Combine(webRoot, "index.html")))
        {
            MessageBox.Show(
                "Не найдены файлы интерфейса (папка web).\n\n" +
                "Переустановите программу или запустите её из папки установки.",
                "АРМ Дежурного ВГСЧ", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        string version = ReadVersion(baseDir);

        LocalServer server;
        try
        {
            server = new LocalServer(webRoot);
            server.Start();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Не удалось запустить внутренний сервер интерфейса.\n\n" + ex.Message,
                "АРМ Дежурного ВГСЧ", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        Application.ThreadException += (_, e) => ShowCrash(e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) => ShowCrash(e.ExceptionObject as Exception);

        Application.Run(new MainForm(server, version));
    }

    private static string ReadVersion(string baseDir)
    {
        string f = Path.Combine(baseDir, "app_version.txt");
        if (File.Exists(f))
        {
            string v = File.ReadAllText(f).Trim();
            if (!string.IsNullOrEmpty(v)) return v;
        }
        return FileVersionInfo.GetVersionInfo(Environment.ProcessPath ?? "").FileVersion ?? "1.0.0";
    }

    private static void ShowCrash(Exception? ex)
    {
        if (ex == null) return;
        try
        {
            string log = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "VGSCH-ARM", "error.log");
            Directory.CreateDirectory(Path.GetDirectoryName(log)!);
            File.AppendAllText(log, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss}  {ex}\r\n\r\n");
        }
        catch { }

        MessageBox.Show("Произошла ошибка:\n\n" + ex.Message,
            "АРМ Дежурного ВГСЧ", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
