# GitHub Release Updater Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable desktop auto-updates from GitHub Releases by activating the Tauri updater plugin, generating release manifests, and adding a safe manual-download fallback in the existing updater UI.

**Architecture:** Keep the current `useUpdater` → Tauri command → Rust updater flow, but wire it to a GitHub-hosted static `latest.json` manifest. Generate updater artifacts and `latest.json` during the existing tag release workflow, and let the dialog fall back to `GitHub Releases` when configuration, signature, or platform issues prevent automatic installation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest, Zustand, Tauri 2.9, Rust, GitHub Actions

---

### Task 1: Harden updater UI state and GitHub Releases fallback

**Files:**
- Modify: `components/starmap/management/updater/__tests__/update-dialog.test.tsx`
- Modify: `lib/tauri/__tests__/updater-hooks.test.ts`
- Modify: `components/starmap/management/updater/update-dialog.tsx`
- Modify: `lib/tauri/updater-hooks.ts`
- Modify: `lib/tauri/updater-api.ts`
- Modify: `i18n/messages/en.json`
- Modify: `i18n/messages/zh.json`
- Reference: `lib/constants/external-links.ts`
- Reference: `lib/tauri/app-control-api.ts`

**Step 1: Write the failing tests**

```ts
it('shows an Open Releases action for updater configuration errors', () => {
  mockUseUpdater.mockReturnValue({
    ...defaultMockReturn,
    error: 'Update service is not configured for this build.',
  });

  renderComponent(true);

  expect(screen.getByRole('button', { name: /open releases/i })).toBeInTheDocument();
});

it('stores the returned error status when downloadAndInstall fails without throwing', async () => {
  mockCheckForUpdate.mockResolvedValue({
    status: 'available',
    data: {
      version: '1.0.1',
      current_version: '1.0.0',
      date: null,
      body: null,
    },
  });
  mockDownloadAndInstallUpdate.mockResolvedValue({
    status: 'error',
    data: 'Signature verification failed.',
  });

  const { result } = renderHook(() => useUpdater());

  await act(async () => {
    await result.current.checkForUpdate();
    await result.current.downloadAndInstall();
  });

  expect(result.current.error).toBe('Signature verification failed.');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/management/updater/__tests__/update-dialog.test.tsx lib/tauri/__tests__/updater-hooks.test.ts`

Expected: FAIL because the dialog does not expose a GitHub Releases fallback action and `downloadAndInstall` / `installUpdate` currently ignore returned `error` statuses from `updater-api`.

**Step 3: Write minimal implementation**

```ts
const result = await apiDownloadAndInstallUpdate();
if (isUpdateError(result)) {
  setStatus(result);
  return;
}
```

```ts
const shouldOfferReleaseFallback = (message: string | null) =>
  Boolean(message) &&
  /(not configured|signature|platform|manifest|latest\.json)/i.test(message);

const handleOpenReleases = async () => {
  await openExternalUrl(EXTERNAL_LINKS.releases);
};
```

- Update `downloadAndInstall` and `installUpdate` to respect returned `UpdateStatus` values instead of relying on thrown exceptions only.
- Add a dialog action that appears only for configuration, signature, manifest, or missing-platform errors.
- Reuse `openExternalUrl` from `lib/tauri/app-control-api.ts`.
- Add i18n keys such as `openReleases`, `manualDownload`, `updateServiceUnavailable`, and `platformPackageUnavailable`.

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- --runInBand components/starmap/management/updater/__tests__/update-dialog.test.tsx lib/tauri/__tests__/updater-hooks.test.ts`

Expected: PASS with the dialog rendering the fallback CTA and hook state moving into `error` when install APIs return `{ status: 'error' }`.

**Step 5: Commit**

```bash
git add components/starmap/management/updater/__tests__/update-dialog.test.tsx lib/tauri/__tests__/updater-hooks.test.ts components/starmap/management/updater/update-dialog.tsx lib/tauri/updater-hooks.ts lib/tauri/updater-api.ts i18n/messages/en.json i18n/messages/zh.json
git commit -m "fix: harden updater error handling"
```

### Task 2: Enable the Tauri updater plugin and normalize backend errors

**Files:**
- Modify: `src-tauri/src/platform/updater.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Write the failing Rust tests**

```rust
#[test]
fn classifies_missing_configuration_errors() {
    let err = normalize_updater_error("failed to build updater: missing endpoints", "check");
    assert!(err.contains("not configured"));
}

#[test]
fn classifies_signature_failures_as_security_errors() {
    let err = normalize_updater_error("signature verification failed", "install");
    assert!(err.contains("Signature verification failed"));
}

#[test]
fn classifies_missing_platform_payloads() {
    let err = normalize_updater_error("target not found in manifest", "check");
    assert!(err.contains("No update package is available for this platform"));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test updater::tests:: --manifest-path src-tauri/Cargo.toml -- --nocapture`

Expected: FAIL because there is no `normalize_updater_error` helper and the updater plugin is still not activated.

**Step 3: Write minimal implementation**

```rust
fn normalize_updater_error(raw: &str, phase: &'static str) -> String {
    let lower = raw.to_lowercase();

    if lower.contains("endpoint") || lower.contains("pubkey") || lower.contains("latest.json") {
        return "Update service is not configured for this build. Open GitHub Releases to install manually.".to_string();
    }

    if lower.contains("signature") {
        return "Signature verification failed. Please download the release manually from GitHub Releases.".to_string();
    }

    if lower.contains("target") || lower.contains("platform") {
        return "No update package is available for this platform yet.".to_string();
    }

    format!("Update {} failed: {}", phase, raw)
}
```

```rust
#[cfg(desktop)]
{
    app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
    app.handle().plugin(tauri_plugin_process::init())?;
}
```

```json
"bundle": {
  "active": true,
  "targets": "all",
  "createUpdaterArtifacts": true
},
"plugins": {
  "updater": {
    "pubkey": "PASTE_REAL_PROJECT_PUBLIC_KEY_HERE",
    "endpoints": [
      "https://github.com/ElementAstro/cobalt-skymap/releases/latest/download/latest.json"
    ]
  }
}
```

- Use the real updater public key generated for this project; do not leave a placeholder in the committed implementation.
- Keep the existing Tauri command names unchanged so no front-end call sites need to be renamed.
- Normalize check, download, and install errors before converting them into `UpdaterError::*`.

**Step 4: Run tests to verify they pass**

Run: `cargo test updater::tests:: --manifest-path src-tauri/Cargo.toml -- --nocapture`

Expected: PASS with normalized messages for configuration, signature, and platform errors.

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: PASS with the updater plugin registered and `tauri.conf.json` still accepted by the build.

**Step 5: Commit**

```bash
git add src-tauri/src/platform/updater.rs src-tauri/src/lib.rs src-tauri/tauri.conf.json
git commit -m "feat: enable tauri github release updater"
```

### Task 3: Generate `latest.json` from release artifacts and wire it into GitHub Actions

**Files:**
- Create: `scripts/updater/build-latest-json.cjs`
- Create: `scripts/updater/__tests__/build-latest-json.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Reference: `CHANGELOG.md`

**Step 1: Write the failing tests**

```ts
it('builds a static updater manifest for GitHub Releases', () => {
  const manifest = buildLatestManifest({
    version: '0.2.0',
    pubDate: '2026-03-06T00:00:00Z',
    notes: '### Added\n- GitHub updater support',
    repository: 'ElementAstro/cobalt-skymap',
    tag: 'v0.2.0',
    assets: [
      {
        platform: 'windows-x86_64',
        fileName: 'Cobalt Skymap_0.2.0_x64_en-US.zip',
        signature: 'windows-signature',
      },
      {
        platform: 'darwin-aarch64',
        fileName: 'Cobalt Skymap.app.tar.gz',
        signature: 'mac-signature',
      },
    ],
  });

  expect(manifest.version).toBe('0.2.0');
  expect(manifest.platforms['windows-x86_64'].url).toContain('/download/v0.2.0/');
  expect(manifest.platforms['windows-x86_64'].signature).toBe('windows-signature');
});

it('fails when CHANGELOG.md does not contain the requested version section', () => {
  expect(() =>
    extractVersionNotes('# Changelog\n\n## [0.1.0] - 2025-01-04', '0.2.0'),
  ).toThrow(/0.2.0/);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand scripts/updater/__tests__/build-latest-json.test.ts`

Expected: FAIL because the manifest generator script and changelog parser do not exist yet.

**Step 3: Write minimal implementation**

```js
function buildLatestManifest({ version, pubDate, notes, repository, tag, assets }) {
  const platforms = {};

  for (const asset of assets) {
    platforms[asset.platform] = {
      signature: asset.signature,
      url: `https://github.com/${repository}/releases/download/${tag}/${asset.fileName}`,
    };
  }

  return {
    version,
    notes,
    pub_date: pubDate,
    platforms,
  };
}
```

```yaml
- name: Upload updater payloads
  uses: actions/upload-artifact@v4
  with:
    name: tauri-updater-${{ matrix.arch }}
    path: |
      src-tauri/target/${{ matrix.target }}/release/bundle/**/*.sig
      src-tauri/target/${{ matrix.target }}/release/bundle/**/*.tar.gz
      src-tauri/target/${{ matrix.target }}/release/bundle/**/*.zip
      src-tauri/target/${{ matrix.target }}/release/bundle/**/*.AppImage
```

```yaml
- name: Generate updater manifest
  if: startsWith(github.ref, 'refs/tags/v')
  run: node scripts/updater/build-latest-json.cjs --repo ${{ github.repository }} --tag ${{ github.ref_name }} --artifacts artifacts --changelog CHANGELOG.md --output artifacts/latest.json
```

- Export both reusable functions and a CLI entry point from `build-latest-json.cjs`.
- Add a package script such as `build:updater-manifest` so the script can be rerun locally.
- In tag builds, inject `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` into the Tauri build step.
- Upload `latest.json`, updater payloads, signatures, and installers in the `create-release` job.

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- --runInBand scripts/updater/__tests__/build-latest-json.test.ts`

Expected: PASS with the generated manifest matching Tauri static JSON shape and changelog extraction failing fast for missing versions.

**Step 5: Commit**

```bash
git add scripts/updater/build-latest-json.cjs scripts/updater/__tests__/build-latest-json.test.ts .github/workflows/ci.yml package.json
git commit -m "ci: publish tauri updater manifest to releases"
```

### Task 4: Document the release contract and run focused validation

**Files:**
- Modify: `CI_CD.md`
- Modify: `docs/deployment/index.md`
- Modify: `docs/deployment/desktop/windows.md`
- Modify: `docs/getting-started/installation.md`

**Step 1: Update the docs**

- Document the required GitHub secrets:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Document the mandatory release artifacts:
  - installers
  - updater payloads
  - `.sig`
  - `latest.json`
- Document that `CHANGELOG.md` must contain the target version before tagging.
- Document that clients only see published releases, not drafts.

**Step 2: Run focused validation**

Run: `pnpm test -- --runInBand components/starmap/management/updater/__tests__/update-dialog.test.tsx lib/tauri/__tests__/updater-hooks.test.ts scripts/updater/__tests__/build-latest-json.test.ts`

Expected: PASS

Run: `pnpm exec tsc --noEmit`

Expected: PASS

Run: `cargo test updater::tests:: --manifest-path src-tauri/Cargo.toml -- --nocapture`

Expected: PASS

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: PASS

**Step 3: Commit**

```bash
git add CI_CD.md docs/deployment/index.md docs/deployment/desktop/windows.md docs/getting-started/installation.md
git commit -m "docs: document github release updater flow"
```

