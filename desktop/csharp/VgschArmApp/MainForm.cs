using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace VgschArm;

public sealed class MainForm : Form
{
    private readonly WebView2 _web = new();
    private readonly LocalServer _server;
    private readonly string _startUrl;
    private CoreWebView2Environment? _env;

    public MainForm(LocalServer server, string version)
    {
        _server = server;
        _startUrl = server.BaseUrl;

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
        return base.ProcessCmdKey(ref msg, keyData);
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
