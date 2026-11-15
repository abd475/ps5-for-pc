using Newtonsoft.Json;
using Playnite.Common;
using Playnite.FullscreenApp.Windows;
using Playnite.SDK;
using Playnite.Windows;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Playnite.FullscreenApp.ViewModels
{
    public class PS5SettingsViewModel : ObservableObject
    {
        private static readonly string SettingsFilePath = Path.Combine(PlaynitePaths.ConfigRootPath, "ps5Settings.json");
        private IWindowFactory window;
        private FullscreenAppViewModel mainModel;

        private string selectedCategory = "System";
        [JsonIgnore]
        public string SelectedCategory
        {
            get => selectedCategory;
            set => SetValue(ref selectedCategory, value);
        }

        [JsonIgnore]
        public string[] Categories { get; } = new[]
        {
            "System",
            "Accessibility",
            "Network",
            "Users and Accounts",
            "Family and Parental Controls",
            "System (Console)",
            "Storage",
            "Sound",
            "Screen and Video",
            "Accessories",
            "Saved Data and Game/App Settings",
            "Notifications",
            "Captures and Broadcasts"
        };

        [JsonIgnore]
        public bool IsConsoleHardwareAvailable => false;

        [JsonIgnore]
        public string NetworkIpAddress => "Unavailable — no console connection";

        [JsonIgnore]
        public string NetworkConnectionType => "Unavailable — no console connection";

        [JsonIgnore]
        public string NetworkLatency => "Unavailable — no console connection";

        [JsonIgnore]
        public string SystemSoftwareVersion => "Unavailable — no console connection";

        [JsonIgnore]
        public string ConsoleStorageStatus => "Console storage data is unavailable on this PC.";

        [JsonIgnore]
        public double ConsoleStorageUsedPercent => 0;

        [JsonIgnore]
        public string[] PrivacyOptions { get; } = new[] { "Only Me", "Friends", "Everyone" };

        [JsonIgnore]
        public string[] Languages { get; } = new[]
        {
            "English",
            "French",
            "German",
            "Italian",
            "Japanese",
            "Spanish"
        };

        [JsonIgnore]
        public string[] ClockFormats { get; } = new[] { "12-hour", "24-hour" };

        [JsonIgnore]
        public string[] TimeZones { get; } = TimeZoneInfo.GetSystemTimeZones().Select(a => a.DisplayName).ToArray();

        [JsonIgnore]
        public string[] InstallLocations { get; } = new[] { "Console Storage", "M.2 SSD", "USB Extended Storage" };

        [JsonIgnore]
        public string[] AudioDevices { get; } = new[] { "Windows default (preference only)" };

        [JsonIgnore]
        public string[] AudioFormats { get; } = new[] { "Linear PCM", "Dolby Audio", "DTS" };

        [JsonIgnore]
        public string[] Resolutions { get; } = new[] { "Auto", "720p", "1080p", "1440p", "2160p" };

        [JsonIgnore]
        public string[] BrightnessOptions { get; } = new[] { "Dim", "Medium", "Bright" };

        [JsonIgnore]
        public string[] PerformanceModes { get; } = new[] { "Performance", "Resolution" };

        [JsonIgnore]
        public string[] CaptureShortcuts { get; } = new[] { "Standard", "Easy Screenshots", "Easy Video Clips" };

        [JsonIgnore]
        public string[] ScreenshotFormats { get; } = new[] { "PNG", "JPEG" };

        [JsonIgnore]
        public string[] VideoFormats { get; } = new[] { "WebM", "MP4" };

        [JsonIgnore]
        public string[] BroadcastResolutions { get; } = new[] { "720p", "1080p" };

        [JsonIgnore]
        public string[] FamilyAccounts { get; } = Array.Empty<string>();

        [JsonIgnore]
        public string[] BluetoothDevices { get; } = Array.Empty<string>();

        [JsonIgnore]
        public RelayCommand CloseCommand => new RelayCommand(SaveAndClose);

        [JsonIgnore]
        public RelayCommand OpenUserGuideCommand => new RelayCommand(() => OpenUrl("https://api.playnite.link/docs/manual/fullscreen-mode.html"));

        [JsonIgnore]
        public RelayCommand ShowLegalCommand => new RelayCommand(() =>
            Dialogs.ShowMessage("Console health, safety and legal information is not available because no console is connected.", "Information unavailable"));

        [JsonIgnore]
        public RelayCommand OpenPlayniteSettingsCommand => new RelayCommand(OpenPlayniteSettings);

        [JsonIgnore]
        public RelayCommand OpenNetworkSettingsCommand => new RelayCommand(() => OpenWindowsSettings("ms-settings:network"));

        [JsonIgnore]
        public RelayCommand OpenWindowsUpdateCommand => new RelayCommand(() => OpenWindowsSettings("ms-settings:windowsupdate"));

        [JsonIgnore]
        public RelayCommand OpenWindowsStorageCommand => new RelayCommand(() => OpenWindowsSettings("ms-settings:storagesense"));

        [JsonIgnore]
        public RelayCommand OpenWindowsSoundCommand => new RelayCommand(() => OpenWindowsSettings("ms-settings:sound"));

        [JsonIgnore]
        public RelayCommand OpenWindowsDisplayCommand => new RelayCommand(() => OpenWindowsSettings("ms-settings:display"));

        [JsonIgnore]
        public RelayCommand OpenWindowsBluetoothCommand => new RelayCommand(() => OpenWindowsSettings("ms-settings:bluetooth"));

        [JsonIgnore]
        public RelayCommand<string> ShowUnsupportedFeatureCommand => new RelayCommand<string>(feature =>
            Dialogs.ShowMessage($"{feature} is unavailable without a connected console.", "Feature unavailable"));

        private bool largerText;
        public bool LargerText { get => largerText; set => SetValue(ref largerText, value); }

        private bool boldText;
        public bool BoldText { get => boldText; set => SetValue(ref boldText, value); }

        private bool highContrast;
        public bool HighContrast { get => highContrast; set => SetValue(ref highContrast, value); }

        private bool screenZoom;
        public bool ScreenZoom { get => screenZoom; set => SetValue(ref screenZoom, value); }

        private bool closedCaptions;
        public bool ClosedCaptions { get => closedCaptions; set => SetValue(ref closedCaptions, value); }

        private bool screenReader;
        public bool ScreenReader { get => screenReader; set => SetValue(ref screenReader, value); }

        private double screenReaderSpeed = 1;
        public double ScreenReaderSpeed { get => screenReaderSpeed; set => SetValue(ref screenReaderSpeed, value); }

        private double controllerVibration = 100;
        public double ControllerVibration { get => controllerVibration; set => SetValue(ref controllerVibration, value); }

        private double triggerIntensity = 100;
        public double TriggerIntensity { get => triggerIntensity; set => SetValue(ref triggerIntensity, value); }

        private bool chatTranscription;
        public bool ChatTranscription { get => chatTranscription; set => SetValue(ref chatTranscription, value); }

        private bool networkEnabled = true;
        public bool NetworkEnabled { get => networkEnabled; set => SetValue(ref networkEnabled, value); }

        private string profileName = string.Empty;
        public string ProfileName { get => profileName; set => SetValue(ref profileName, value); }

        private string signInId = string.Empty;
        public string SignInId { get => signInId; set => SetValue(ref signInId, value); }

        private string onlineStatusPrivacy = "Friends";
        public string OnlineStatusPrivacy { get => onlineStatusPrivacy; set => SetValue(ref onlineStatusPrivacy, value); }

        private string trophyPrivacy = "Friends";
        public string TrophyPrivacy { get => trophyPrivacy; set => SetValue(ref trophyPrivacy, value); }

        private bool autoLogin;
        public bool AutoLogin { get => autoLogin; set => SetValue(ref autoLogin, value); }

        private bool restrictWebBrowsing;
        public bool RestrictWebBrowsing { get => restrictWebBrowsing; set => SetValue(ref restrictWebBrowsing, value); }

        private bool restrictGuestLogin;
        public bool RestrictGuestLogin { get => restrictGuestLogin; set => SetValue(ref restrictGuestLogin, value); }

        private bool hdmiCec;
        public bool HdmiCec { get => hdmiCec; set => SetValue(ref hdmiCec, value); }

        private bool hdcp = true;
        public bool Hdcp { get => hdcp; set => SetValue(ref hdcp, value); }

        private string language = "English";
        public string Language { get => language; set => SetValue(ref language, value); }

        private string clockFormat = "12-hour";
        public string ClockFormat { get => clockFormat; set => SetValue(ref clockFormat, value); }

        private string timeZone = TimeZoneInfo.Local.DisplayName;
        public string TimeZone { get => timeZone; set => SetValue(ref timeZone, value); }

        private bool remotePlay;
        public bool RemotePlay { get => remotePlay; set => SetValue(ref remotePlay, value); }

        private double idleSleepMinutes = 60;
        public double IdleSleepMinutes { get => idleSleepMinutes; set => SetValue(ref idleSleepMinutes, value); }

        private double startupBeepVolume = 50;
        public double StartupBeepVolume { get => startupBeepVolume; set => SetValue(ref startupBeepVolume, value); }

        private string installLocation = "Console Storage";
        public string InstallLocation { get => installLocation; set => SetValue(ref installLocation, value); }

        private string microphoneDevice = "Windows default (preference only)";
        public string MicrophoneDevice { get => microphoneDevice; set => SetValue(ref microphoneDevice, value); }

        private double microphoneLevel = 50;
        public double MicrophoneLevel { get => microphoneLevel; set => SetValue(ref microphoneLevel, value); }

        private string audioOutputDevice = "Windows default (preference only)";
        public string AudioOutputDevice { get => audioOutputDevice; set => SetValue(ref audioOutputDevice, value); }

        private string audioFormat = "Linear PCM";
        public string AudioFormat { get => audioFormat; set => SetValue(ref audioFormat, value); }

        private bool backgroundMusic = true;
        public bool BackgroundMusic { get => backgroundMusic; set => SetValue(ref backgroundMusic, value); }

        private double headphoneVolume = 50;
        public double HeadphoneVolume { get => headphoneVolume; set => SetValue(ref headphoneVolume, value); }

        private double controllerSpeakerVolume = 50;
        public double ControllerSpeakerVolume { get => controllerSpeakerVolume; set => SetValue(ref controllerSpeakerVolume, value); }

        private string videoResolution = "Auto";
        public string VideoResolution { get => videoResolution; set => SetValue(ref videoResolution, value); }

        private bool variableRefreshRate;
        public bool VariableRefreshRate { get => variableRefreshRate; set => SetValue(ref variableRefreshRate, value); }

        private bool output120Hz;
        public bool Output120Hz { get => output120Hz; set => SetValue(ref output120Hz, value); }

        private double screenDimMinutes = 60;
        public double ScreenDimMinutes { get => screenDimMinutes; set => SetValue(ref screenDimMinutes, value); }

        private double hapticsIntensity = 100;
        public double HapticsIntensity { get => hapticsIntensity; set => SetValue(ref hapticsIntensity, value); }

        private bool triggerEffects = true;
        public bool TriggerEffects { get => triggerEffects; set => SetValue(ref triggerEffects, value); }

        private string controllerLightBrightness = "Bright";
        public string ControllerLightBrightness { get => controllerLightBrightness; set => SetValue(ref controllerLightBrightness, value); }

        private bool cloudSaveSync = true;
        public bool CloudSaveSync { get => cloudSaveSync; set => SetValue(ref cloudSaveSync, value); }

        private string performanceMode = "Performance";
        public string PerformanceMode { get => performanceMode; set => SetValue(ref performanceMode, value); }

        private bool defaultSubtitles;
        public bool DefaultSubtitles { get => defaultSubtitles; set => SetValue(ref defaultSubtitles, value); }

        private bool backgroundUpdates = true;
        public bool BackgroundUpdates { get => backgroundUpdates; set => SetValue(ref backgroundUpdates, value); }

        private bool popUpNotifications = true;
        public bool PopUpNotifications { get => popUpNotifications; set => SetValue(ref popUpNotifications, value); }

        private bool friendRequestAlerts = true;
        public bool FriendRequestAlerts { get => friendRequestAlerts; set => SetValue(ref friendRequestAlerts, value); }

        private bool trophyAlerts = true;
        public bool TrophyAlerts { get => trophyAlerts; set => SetValue(ref trophyAlerts, value); }

        private bool downloadAlerts = true;
        public bool DownloadAlerts { get => downloadAlerts; set => SetValue(ref downloadAlerts, value); }

        private string createButtonShortcut = "Standard";
        public string CreateButtonShortcut { get => createButtonShortcut; set => SetValue(ref createButtonShortcut, value); }

        private string screenshotFormat = "PNG";
        public string ScreenshotFormat { get => screenshotFormat; set => SetValue(ref screenshotFormat, value); }

        private string videoFormat = "MP4";
        public string VideoFormat { get => videoFormat; set => SetValue(ref videoFormat, value); }

        private string broadcastResolution = "1080p";
        public string BroadcastResolution { get => broadcastResolution; set => SetValue(ref broadcastResolution, value); }

        private bool broadcastMicrophone;
        public bool BroadcastMicrophone { get => broadcastMicrophone; set => SetValue(ref broadcastMicrophone, value); }

        public static PS5SettingsViewModel Create(IWindowFactory window, FullscreenAppViewModel mainModel)
        {
            var viewModel = File.Exists(SettingsFilePath) ?
                Serialization.FromJsonFile<PS5SettingsViewModel>(SettingsFilePath) :
                new PS5SettingsViewModel();
            viewModel.window = window;
            viewModel.mainModel = mainModel;
            return viewModel;
        }

        public bool? OpenView()
        {
            return window.CreateAndOpenDialog(this);
        }

        private void SaveAndClose()
        {
            try
            {
                Directory.CreateDirectory(PlaynitePaths.ConfigRootPath);
                File.WriteAllText(SettingsFilePath, Serialization.ToJson(this, true));
            }
            catch (Exception ex)
            {
                Dialogs.ShowErrorMessage(ex.Message, "Unable to save settings");
                return;
            }

            window.Close(true);
        }

        private void OpenPlayniteSettings()
        {
            try
            {
                Directory.CreateDirectory(PlaynitePaths.ConfigRootPath);
                File.WriteAllText(SettingsFilePath, Serialization.ToJson(this, true));
            }
            catch (Exception ex)
            {
                Dialogs.ShowErrorMessage(ex.Message, "Unable to save settings");
                return;
            }

            window.Close(true);
            new SettingsViewModel(new SettingsWindowFactory(), mainModel).OpenView();
        }

        private static void OpenUrl(string url)
        {
            OpenWindowsSettings(url);
        }

        private static void OpenWindowsSettings(string uri)
        {
            try
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(uri)
                {
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                Dialogs.ShowErrorMessage(ex.Message, "Unable to open the requested page");
            }
        }
    }
}
