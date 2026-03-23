/**
 * @jest-environment jsdom
 */

import {
  getDialogMobileRequirement,
  STARMAP_DIALOG_MOBILE_REQUIREMENTS,
  STARMAP_DIALOG_ROLLOUT_ORDER,
} from '../mobile-dialog-inventory';

describe('mobile-dialog-inventory', () => {
  it('provides unique dialog ids in the inventory', () => {
    const ids = STARMAP_DIALOG_MOBILE_REQUIREMENTS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('looks up existing ids and returns null for unknown ids', () => {
    const feedback = getDialogMobileRequirement('feedback-dialog');

    expect(feedback).toMatchObject({
      id: 'feedback-dialog',
      area: 'dialogs',
      tier: 'custom',
      mobileMode: 'custom',
      closeBehavior: 'confirm-before-close',
    });
    expect(getDialogMobileRequirement('does-not-exist')).toBeNull();
  });

  it('keeps rollout order aligned with inventory size and sorted by priority', () => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2 } as const;
    const ranked = STARMAP_DIALOG_ROLLOUT_ORDER.map((id) => {
      const requirement = getDialogMobileRequirement(id);
      expect(requirement).not.toBeNull();
      return priorityOrder[requirement!.rolloutPriority];
    });

    expect(STARMAP_DIALOG_ROLLOUT_ORDER).toHaveLength(STARMAP_DIALOG_MOBILE_REQUIREMENTS.length);
    expect(ranked).toEqual([...ranked].sort((left, right) => left - right));
  });

  it('includes expected dialog-area registrations for core dialogs', () => {
    const dialogsArea = STARMAP_DIALOG_MOBILE_REQUIREMENTS
      .filter((item) => item.area === 'dialogs')
      .map((item) => item.id);

    expect(dialogsArea).toEqual(
      expect.arrayContaining([
        'about-dialog',
        'keyboard-shortcuts-dialog',
        'stellarium-credits-dialog',
        'feedback-dialog',
      ])
    );
  });
});
