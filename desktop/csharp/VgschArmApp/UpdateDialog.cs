namespace VgschArm;

/// <summary>Окно «Доступно обновление» — простое и понятное для дежурного.</summary>
public sealed class UpdateDialog : Form
{
    private readonly Updater.UpdateInfo _info;
    private readonly ProgressBar _bar = new();
    private readonly Label _status = new();
    private readonly Button _install = new();
    private readonly Button _later = new();
    private readonly CancellationTokenSource _cts = new();

    public UpdateDialog(Updater.UpdateInfo info, string currentVersion, Icon? icon)
    {
        _info = info;

        Text = "Доступно обновление";
        Width = 520;
        Height = info.Mandatory ? 300 : 290;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(14, 22, 40);
        ForeColor = Color.White;
        Font = new Font("Segoe UI", 9.5f);
        if (icon != null) Icon = icon;

        var title = new Label
        {
            Text = $"Новая версия {info.Version}",
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            ForeColor = Color.FromArgb(232, 93, 4),
            AutoSize = true,
            Location = new Point(24, 22),
        };

        var sub = new Label
        {
            Text = $"Установлена версия {currentVersion}   ·   размер {FmtSize(info.FileSize)}",
            ForeColor = Color.FromArgb(150, 165, 190),
            AutoSize = true,
            Location = new Point(26, 54),
        };

        var notes = new Label
        {
            Text = string.IsNullOrWhiteSpace(info.Notes) ? "Улучшения и исправления." : info.Notes,
            Location = new Point(26, 86),
            Size = new Size(460, 60),
            ForeColor = Color.FromArgb(215, 225, 240),
        };

        if (info.Mandatory)
        {
            var must = new Label
            {
                Text = "Обновление обязательное — работа на старой версии невозможна.",
                Location = new Point(26, 146),
                Size = new Size(460, 22),
                ForeColor = Color.FromArgb(255, 120, 100),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
            };
            Controls.Add(must);
        }

        _bar.Location = new Point(26, 176);
        _bar.Size = new Size(460, 8);
        _bar.Style = ProgressBarStyle.Continuous;
        _bar.Visible = false;

        _status.Location = new Point(26, 190);
        _status.Size = new Size(460, 20);
        _status.ForeColor = Color.FromArgb(150, 165, 190);
        _status.Visible = false;

        _install.Text = "Установить обновление";
        _install.Size = new Size(210, 38);
        _install.Location = new Point(276, 214);
        _install.FlatStyle = FlatStyle.Flat;
        _install.BackColor = Color.FromArgb(232, 93, 4);
        _install.ForeColor = Color.White;
        _install.FlatAppearance.BorderSize = 0;
        _install.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
        _install.Click += OnInstall;

        _later.Text = info.Mandatory ? "Выйти" : "Позже";
        _later.Size = new Size(120, 38);
        _later.Location = new Point(146, 214);
        _later.FlatStyle = FlatStyle.Flat;
        _later.BackColor = Color.FromArgb(28, 40, 66);
        _later.ForeColor = Color.FromArgb(200, 212, 230);
        _later.FlatAppearance.BorderSize = 0;
        _later.Click += (_, _) =>
        {
            DialogResult = info.Mandatory ? DialogResult.Abort : DialogResult.Cancel;
            Close();
        };

        Controls.AddRange(new Control[] { title, sub, notes, _bar, _status, _install, _later });
        FormClosing += (_, e) =>
        {
            if (info.Mandatory && DialogResult == DialogResult.None)
            {
                DialogResult = DialogResult.Abort;
            }
            _cts.Cancel();
            _ = e;
        };
    }

    private async void OnInstall(object? sender, EventArgs e)
    {
        _install.Enabled = false;
        _later.Enabled = false;
        _bar.Visible = true;
        _status.Visible = true;
        _status.Text = "Загрузка обновления…";

        var progress = new Progress<int>(p =>
        {
            _bar.Value = Math.Min(100, Math.Max(0, p));
            _status.Text = $"Загрузка обновления… {p}%";
        });

        try
        {
            await Updater.DownloadAndRunAsync(_info, progress, _cts.Token);
            await Updater.CountDownloadAsync(_info.Version);
            _status.Text = "Запуск установки…";
            DialogResult = DialogResult.OK;
            Close();
        }
        catch (Exception ex)
        {
            _bar.Visible = false;
            _status.ForeColor = Color.FromArgb(255, 120, 100);
            _status.Text = "Не удалось загрузить обновление";
            MessageBox.Show(
                "Не удалось загрузить обновление.\n\n" + ex.Message +
                "\n\nПроверьте подключение к сети и попробуйте позже.",
                "АРМ Дежурного ВГСЧ", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            _install.Enabled = true;
            _later.Enabled = true;
        }
    }

    private static string FmtSize(long b)
    {
        if (b >= 1024 * 1024) return $"{b / 1024.0 / 1024.0:F1} МБ";
        if (b >= 1024) return $"{b / 1024} КБ";
        return $"{b} Б";
    }
}
