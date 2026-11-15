using Playnite.Controls;
using Playnite.Windows;
using System.Windows;

namespace Playnite.FullscreenApp.Windows
{
    public class PS5SettingsWindowFactory : WindowFactory
    {
        public override WindowBase CreateNewWindowInstance()
        {
            return new PS5SettingsWindow();
        }
    }

    public partial class PS5SettingsWindow : WindowBase
    {
        public PS5SettingsWindow()
        {
            InitializeComponent();
            WindowTools.ConfigureChildWindow(this);
        }
    }
}
