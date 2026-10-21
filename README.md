# SOC Page Refresh & Keyword Monitor — Installation & User Guide

A cybersecurity SOC-themed Google Chrome extension (Manifest V3) that provides automated page reloads, a two-digit toolbar badge countdown, exact-string keyword detection, in-page HUD alerts, and non-stacking Windows desktop notifications.

Repository: [https://github.com/zohan205/SOC-Page-Refresher](https://github.com/zohan205/SOC-Page-Refresher)

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Download the Extension](#step-1-download-the-extension)
   - [Option A: Download as ZIP (Recommended)](#option-a-download-as-zip-recommended)
   - [Option B: Clone with Git](#option-b-clone-with-git)
3. [Step 2: Load the Extension into Google Chrome](#step-2-load-the-extension-into-google-chrome)
4. [Step 3: Pin the Extension to Chrome Toolbar](#step-3-pin-the-extension-to-chrome-toolbar)
5. [Step 4: Using the Extension](#step-4-using-the-extension)
   - [Configuring the Refresh Engine](#configuring-the-refresh-engine)
   - [Configuring Keyword Detection](#configuring-keyword-detection)
   - [Starting and Stopping Sessions](#starting-and-stopping-sessions)
6. [Notification & Alert Behavior](#notification--alert-behavior)
7. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## Prerequisites
- **Google Chrome** (version 88 or later for Manifest V3 support) or any Chromium-based browser (Brave, Microsoft Edge, Opera).
- Windows 10/11, macOS, or Linux.

---

## Step 1: Download the Extension

### Option A: Download as ZIP (Recommended)
1. Go to the repository: [https://github.com/zohan205/SOC-Page-Refresher](https://github.com/zohan205/SOC-Page-Refresher).
2. Click the green **Code** button near the top right.
3. Click **Download ZIP**.
4. Once downloaded, extract the ZIP file:
   - **Windows:** Right-click the `.zip` file $\rightarrow$ **Extract All...** $\rightarrow$ choose a permanent destination folder (e.g., `Documents` or `Projects`).
   - *Note: Do not delete or move this extracted folder after loading, as Chrome runs the extension directly from it.*

### Option B: Clone with Git
If you have Git installed, open your terminal or command prompt:
```bash
git clone https://github.com/zohan205/SOC-Page-Refresher.git
cd SOC-Page-Refresher
```

---

## Step 2: Load the Extension into Google Chrome

1. Open **Google Chrome**.
2. In the URL address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. Look at the top-right corner and toggle **Developer mode** to **ON**.
4. In the top-left corner, click the **Load unpacked** button.
5. In the file picker, select the project folder containing `manifest.json` (e.g., `SOC-Page-Refresher` or `SOC-Page-Refresher-main`).
6. Click **Select Folder**.
7. The extension card titled **SOC Monitor** will now appear in your extensions list.

---

## Step 3: Pin the Extension to Chrome Toolbar

To keep track of the two-digit countdown timer and match counts:
1. Click the **Extensions puzzle icon** (🧩) on the top-right of your Chrome browser bar.
2. Find **SOC Monitor**.
3. Click the **Pin** icon (📌) next to it so the neon SOC shield stays visible on your toolbar.

---

## Step 4: Using the Extension

### 1. Navigate to Target Webpage
Open the webpage you wish to monitor (e.g., any `http://` or `https://` site). 

> *Note: Chrome security rules prevent content scripts and page reloads on internal pages like `chrome://` or the Chrome Web Store.*

### 2. Open the SOC Monitor Console
Click the SOC shield icon on your toolbar to open the dark-neon command popup.

### 3. Configuring the Refresh Engine
- **Interval (seconds):** Enter the delay between reloads (minimum 5 seconds; recommended 10–30s).
- **Mode:**
  - **Infinite Loop:** Keeps refreshing continuously until you press HALT.
  - **Finite Limit:** Stops automatically after reaching your configured number of reloads.

### 4. Configuring Keyword Detection
- **Target String:** Enter the exact phrase, string, or keyword you want to search for (e.g., `sale`, `CRITICAL`, `error`, `available`).
- **Enable Monitor:** Keep checked to activate automatic keyword counting after every refresh.
- **Desktop Alert:** Enable to receive a native operating system notification when matches are found.
- **Case Sensitive:** 
  - Unchecked: matches `Sale`, `SALE`, and `sale`.
  - Checked: matches strictly your exact capitalization.
- **Search Raw DOM (HTML):**
  - Unchecked: searches only rendered, visible page text.
  - Checked: inspects the entire underlying HTML markup, attributes, and script tags.

### 5. Starting and Stopping Sessions
- Click **START SESSION**:
  - Status indicator shifts from gray **IDLE** to glowing cyan **RUNNING**.
  - The live countdown starts on both the popup and your Chrome toolbar icon.
  - Any prior active session on other tabs will automatically be halted (single-tab safety policy).
- Click **HALT**:
  - Immediately stops any scheduled reloads and resets the status to **IDLE**.

---

## Notification & Alert Behavior

1. **In-Page Overlay (HUD):**
   - Appears at the bottom-left corner of the webpage showing:
     `"keyword" found on this webpage X times`.
   - Dismissible instantly by clicking anywhere on the webpage or pressing `Esc`.
   - Encapsulated inside a Shadow DOM so its presence never inflates keyword counts.

2. **Tab Title Badge:**
   - The tab title is automatically prefixed with `[X MATCHES]`, allowing you to see results from the Chrome tab strip even when viewing another tab.

3. **Desktop Toast Notifications:**
   - **Smart Focus Suppression:** If you are actively looking at the monitored tab, desktop popups are suppressed (the in-page HUD handles visibility).
   - **Background Alert:** When you are working in another app (like VS Code, Word, or another browser window), a Windows toast notification will alert you.
   - **No Stacking & Auto-Dismiss:** Desktop notifications automatically dismiss after 3 seconds and update in-place without piling up.

---

## Troubleshooting & FAQs

### The Start Session button does not respond:
1. Navigate to `chrome://extensions`.
2. Find **SOC Monitor** and click the **Reload** (circular arrow ⟳) icon.
3. If an **Errors** button is visible, click it and select **Clear All**.
4. Re-open your target page and open the extension popup.

### Desktop notifications are not popping up over other applications:
1. Open **Windows Settings** (`Win + I`) $\rightarrow$ **System** $\rightarrow$ **Notifications**.
2. Ensure **Notifications** are set to **On**.
3. Check that **Focus Assist / Do Not Disturb** is **Off** (Windows often blocks banners when coding or in full-screen windows).
4. Verify that Google Chrome is permitted to show banner notifications.

### Moving or Renaming the Project Folder:
Because Chrome loads unpacked extensions directly from the local folder path, moving or deleting the folder will cause Chrome to report `Extension directory is missing`. If you move the folder, repeat the **Load unpacked** step pointing to the new folder location.