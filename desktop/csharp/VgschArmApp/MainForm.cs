using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace VgschArm;

public sealed class MainForm : Form
{
    private readonly WebView2 _web = new();
    private readonly LocalServer _server;
    private readonly string _startUrl;
    private readonly string _version;
    private CoreWebView2Environment? _env;

    public MainForm(LocalServer server, string version)
    {
        _server = server;
        _startUrl = server.BaseUrl;
        _version = version;

        Text = $"АРМ Дежурного ВГСЧ  —  v{version}";
        WindowState = FormWindowState.Maximized;
        MinimumSize = new Size(1024, 700);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(0, 26, 64);

        string ico = Path.Combine(AppContext.BaseDirectory, "vgsch.ico");
        if (File.Exists(ico))
        {
            try { Icon = new Icon(ico); } catch { }
        }

        _web.Dock = DockStyle.Fill;
        _web.DefaultBackgroundColor = Color.FromArgb(0, 26, 64);
        Controls.Add(_web);

        Load += async (_, _) => await InitWebViewAsync();
        FormClosed += (_, _) => _server.Dispose();
    }

    private async Task InitWebViewAsync()
    {
        string userData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "VGSCH-ARM", "WebView2");
        Directory.CreateDirectory(userData);

        try
        {
            _env = await CoreWebView2Environment.CreateAsync(null, userData);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Не удалось запустить компонент WebView2.\n\n" +
                "Установите Microsoft Edge WebView2 Runtime:\n" +
                "https://go.microsoft.com/fwlink/p/?LinkId=2124703\n\n" +
                ex.Message,
                "АРМ Дежурного ВГСЧ", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
            return;
        }

        await _web.EnsureCoreWebView2Async(_env);
        var core = _web.CoreWebView2;

        // Убираем браузерный антураж — это программа, а не браузер
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.AreBrowserAcceleratorKeysEnabled = false;
        core.Settings.IsSwipeNavigationEnabled = false;
        core.Settings.IsZoomControlEnabled = true;

        // Табло и окно печати открываются внутри программы, не в браузере
        core.NewWindowRequested += OnNewWindowRequested;

        core.Navigate(_startUrl);

        // Проверяем обновление в фоне — интерфейс уже работает,
        // дежурный не ждёт ответа сервера при запуске
        _ = CheckUpdateAsync();
    }

    private async Task CheckUpdateAsync()
    {
        // Во время проверки сборки окно обновления только мешает
        if (Environment.GetEnvironmentVariable("VGSCH_SMOKE_TEST") == "1") return;

        await Task.Delay(3000);

        var info = await Updater.CheckAsync(_version);
        if (info == null || IsDisposed) return;

        // Необязательное обновление показываем не чаще раза в сутки
        if (!info.Mandatory && WasSkippedToday(info.Version)) return;

        if (InvokeRequired)
        {
            BeginInvoke(new Action(() => ShowUpdateDialog(info)));
        }
        else
        {
            ShowUpdateDialog(info);
        }
    }

    private void ShowUpdateDialog(Updater.UpdateInfo info)
    {
        using var dlg = new UpdateDialog(info, _version, Icon);
        var res = dlg.ShowDialog(this);

        if (res == DialogResult.OK || res == DialogResult.Abort)
        {
            Close();
            return;
        }
        RememberSkip(info.Version);
    }

    private static string SkipFile => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "VGSCH-ARM", "update-skip.txt");

    private static bool WasSkippedToday(string version)
    {
        try
        {
            if (!File.Exists(SkipFile)) return false;
            string[] p = File.ReadAllText(SkipFile).Trim().Split('|');
            return p.Length == 2 && p[0] == version && p[1] == DateTime.Today.ToString("yyyy-MM-dd");
        }
        catch { return false; }
    }

    private static void RememberSkip(string version)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(SkipFile)!);
            File.WriteAllText(SkipFile, $"{version}|{DateTime.Today:yyyy-MM-dd}");
        }
        catch { }
    }

    private async void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        var deferral = e.GetDeferral();
        try
        {
            var child = new ChildWindow(Icon);
            child.Show(this);
            await child.InitAsync(_env!);
            e.NewWindow = child.WebCore;
        }
        catch
        {
            e.Handled = false;
        }
        finally
        {
            deferral.Complete();
        }
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        // F5 — перезагрузить интерфейс, F11 — полноэкранный режим
        if (keyData == Keys.F5)
        {
            _web.CoreWebView2?.Reload();
            return true;
        }
        if (keyData == Keys.F11)
        {
            FormBorderStyle = FormBorderStyle == FormBorderStyle.None
                ? FormBorderStyle.Sizable : FormBorderStyle.None;
            WindowState = FormWindowState.Normal;
            WindowState = FormWindowState.Maximized;
            return true;
        }
        if (keyData == Keys.F9)
        {
            _ = CheckUpdateManualAsync();
            return true;
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }

    /// <summary>Ручная проверка обновления по F9 — когда дежурного просят обновиться.</summary>
    private async Task CheckUpdateManualAsync()
    {
        Cursor = Cursors.WaitCursor;
        var info = await Updater.CheckAsync(_version);
        Cursor = Cursors.Default;

        if (info == null)
        {
            MessageBox.Show(
                $"Установлена последняя версия {_version}.",
                "АРМ Дежурного ВГСЧ", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        ShowUpdateDialog(info);
    }
}

/// <summary>Дочернее окно — для табло и окна печати путёвки.</summary>
internal sealed class ChildWindow : Form
{
    private readonly WebView2 _web = new();
    public CoreWebView2? WebCore => _web.CoreWebView2;

    public ChildWindow(Icon? icon)
    {
        Text = "АРМ Дежурного ВГСЧ";
        Width = 1280;
        Height = 880;
        StartPosition = FormStartPosition.CenterParent;
        BackColor = Color.FromArgb(0, 26, 64);
        if (icon != null) Icon = icon;

        _web.Dock = DockStyle.Fill;
        _web.DefaultBackgroundColor = Color.FromArgb(0, 26, 64);
        Controls.Add(_web);
    }

    public async Task InitAsync(CoreWebView2Environment env)
    {
        await _web.EnsureCoreWebView2Async(env);
        _web.CoreWebView2.WindowCloseRequested += (_, _) => Close();
    }
}