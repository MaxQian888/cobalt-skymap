import { create } from 'zustand';
import { useLocaleStore } from '@/lib/i18n/locale-store';
import {
  applySettingsTransaction,
  type ApplySettingsTransactionResult,
} from '@/lib/settings/apply-settings-transaction';
import {
  cloneSettingsDraft,
  computeDirtyFieldPaths,
  createDefaultSettingsDraft,
  createSettingsDraftSnapshot,
  deriveDirtyCategories,
  resetDraftCategory,
  type SettingsDraft,
  type SettingsDraftCategory,
  type SettingsDraftPath,
} from '@/lib/settings/settings-draft';
import {
  validateSettingsDraft,
  type SettingsDraftValidationResult,
} from '@/lib/settings/settings-validation';

const EMPTY_APPLY_RESULT: ApplySettingsTransactionResult = {
  success: false,
  appliedDomains: [],
  failedDomains: [],
  rolledBackDomains: [],
};

interface SettingsSessionState {
  sessionActive: boolean;
  baseline: SettingsDraft | null;
  draft: SettingsDraft | null;
  dirtyPaths: SettingsDraftPath[];
  dirtyCategories: SettingsDraftCategory[];
  validation: SettingsDraftValidationResult;
  lastApplyResult: ApplySettingsTransactionResult | null;

  startSession: (snapshot?: SettingsDraft) => void;
  updateDraft: (updater: (current: SettingsDraft) => SettingsDraft) => void;
  cancelSession: () => void;
  clearSession: () => void;
  resetCategoryDraft: (category: SettingsDraftCategory) => void;
  resetAllDraftToDefaults: () => void;
  applyDraft: () => Promise<ApplySettingsTransactionResult>;
  clearLastApplyResult: () => void;

  setConnection: (connection: Partial<SettingsDraft['connection']>) => void;
  setBackendProtocol: (protocol: SettingsDraft['backendProtocol']) => void;
  setPreference: <K extends keyof SettingsDraft['preferences']>(
    key: K,
    value: SettingsDraft['preferences'][K],
  ) => void;
  setPerformanceSetting: <K extends keyof SettingsDraft['performance']>(
    key: K,
    value: SettingsDraft['performance'][K],
  ) => void;
  setAccessibilitySetting: <K extends keyof SettingsDraft['accessibility']>(
    key: K,
    value: SettingsDraft['accessibility'][K],
  ) => void;
  setNotificationSetting: <K extends keyof SettingsDraft['notifications']>(
    key: K,
    value: SettingsDraft['notifications'][K],
  ) => void;
  setSearchSetting: <K extends keyof SettingsDraft['search']>(
    key: K,
    value: SettingsDraft['search'][K],
  ) => void;
  setLocation: (location: Partial<SettingsDraft['location']>) => void;
}

function buildInvalidApplyResult(validation: SettingsDraftValidationResult): ApplySettingsTransactionResult {
  if (validation.issues.length === 0) {
    return {
      ...EMPTY_APPLY_RESULT,
      failedDomains: [{ domain: 'connection', error: 'Draft validation failed.' }],
    };
  }

  const firstIssue = validation.issues[0];
  return {
    ...EMPTY_APPLY_RESULT,
    failedDomains: [{ domain: firstIssue.category, error: firstIssue.message }],
  };
}

function computeSessionState(
  baseline: SettingsDraft,
  draft: SettingsDraft,
): Pick<SettingsSessionState, 'dirtyPaths' | 'dirtyCategories' | 'validation'> {
  const dirtyPaths = computeDirtyFieldPaths(baseline, draft);
  return {
    dirtyPaths,
    dirtyCategories: deriveDirtyCategories(dirtyPaths),
    validation: validateSettingsDraft(draft),
  };
}

export const useSettingsSessionStore = create<SettingsSessionState>()((set, get) => ({
  sessionActive: false,
  baseline: null,
  draft: null,
  dirtyPaths: [],
  dirtyCategories: [],
  validation: validateSettingsDraft(createDefaultSettingsDraft()),
  lastApplyResult: null,

  startSession: (snapshot) => {
    const baseline = cloneSettingsDraft(snapshot ?? createSettingsDraftSnapshot());
    const draft = cloneSettingsDraft(baseline);
    set({
      sessionActive: true,
      baseline,
      draft,
      ...computeSessionState(baseline, draft),
      lastApplyResult: null,
    });
  },

  updateDraft: (updater) => {
    const state = get();
    if (!state.sessionActive || !state.baseline || !state.draft) {
      return;
    }

    const nextDraft = cloneSettingsDraft(updater(cloneSettingsDraft(state.draft)));
    set({
      draft: nextDraft,
      ...computeSessionState(state.baseline, nextDraft),
      lastApplyResult: null,
    });
  },

  cancelSession: () => {
    const state = get();
    if (!state.sessionActive || !state.baseline) {
      return;
    }
    const nextDraft = cloneSettingsDraft(state.baseline);
    set({
      draft: nextDraft,
      ...computeSessionState(state.baseline, nextDraft),
      lastApplyResult: null,
    });
  },

  clearSession: () => {
    set({
      sessionActive: false,
      baseline: null,
      draft: null,
      dirtyPaths: [],
      dirtyCategories: [],
      validation: validateSettingsDraft(createDefaultSettingsDraft()),
      lastApplyResult: null,
    });
  },

  resetCategoryDraft: (category) => {
    const state = get();
    if (!state.sessionActive || !state.baseline || !state.draft) {
      return;
    }
    const nextDraft = resetDraftCategory(
      state.draft,
      category,
      createDefaultSettingsDraft(),
    );
    set({
      draft: nextDraft,
      ...computeSessionState(state.baseline, nextDraft),
      lastApplyResult: null,
    });
  },

  resetAllDraftToDefaults: () => {
    const state = get();
    if (!state.sessionActive || !state.baseline) {
      return;
    }

    const nextDraft = createDefaultSettingsDraft();
    set({
      draft: nextDraft,
      ...computeSessionState(state.baseline, nextDraft),
      lastApplyResult: null,
    });
  },

  applyDraft: async () => {
    const state = get();
    if (!state.sessionActive || !state.baseline || !state.draft) {
      set({ lastApplyResult: EMPTY_APPLY_RESULT });
      return EMPTY_APPLY_RESULT;
    }

    if (!state.validation.isValid) {
      const invalidResult = buildInvalidApplyResult(state.validation);
      set({ lastApplyResult: invalidResult });
      return invalidResult;
    }

    const result = await applySettingsTransaction(state.draft);
    if (!result.success) {
      set({ lastApplyResult: result });
      return result;
    }

    useLocaleStore.getState().setLocale(state.draft.preferences.locale);

    const nextBaseline = cloneSettingsDraft(state.draft);
    set({
      baseline: nextBaseline,
      draft: cloneSettingsDraft(nextBaseline),
      ...computeSessionState(nextBaseline, nextBaseline),
      lastApplyResult: result,
    });
    return result;
  },

  clearLastApplyResult: () => {
    set({ lastApplyResult: null });
  },

  setConnection: (connection) => {
    get().updateDraft((current) => ({
      ...current,
      connection: { ...current.connection, ...connection },
    }));
  },

  setBackendProtocol: (protocol) => {
    get().updateDraft((current) => ({
      ...current,
      backendProtocol: protocol,
    }));
  },

  setPreference: (key, value) => {
    get().updateDraft((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));
  },

  setPerformanceSetting: (key, value) => {
    get().updateDraft((current) => ({
      ...current,
      performance: { ...current.performance, [key]: value },
    }));
  },

  setAccessibilitySetting: (key, value) => {
    get().updateDraft((current) => ({
      ...current,
      accessibility: { ...current.accessibility, [key]: value },
    }));
  },

  setNotificationSetting: (key, value) => {
    get().updateDraft((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    }));
  },

  setSearchSetting: (key, value) => {
    get().updateDraft((current) => ({
      ...current,
      search: { ...current.search, [key]: value },
    }));
  },

  setLocation: (location) => {
    get().updateDraft((current) => ({
      ...current,
      location: { ...current.location, ...location },
    }));
  },
}));
