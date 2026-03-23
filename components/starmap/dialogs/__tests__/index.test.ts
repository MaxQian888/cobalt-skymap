/**
 * @jest-environment jsdom
 */

jest.mock('../about-dialog', () => ({
  AboutDialog: 'AboutDialogMock',
}));

jest.mock('../feedback-dialog', () => ({
  FeedbackDialog: 'FeedbackDialogMock',
}));

jest.mock('../keyboard-shortcuts-dialog', () => ({
  KeyboardShortcutsDialog: 'KeyboardShortcutsDialogMock',
}));

jest.mock('../stellarium-credits', () => ({
  StellariumCredits: 'StellariumCreditsMock',
}));

jest.mock('../responsive-dialog-shell', () => ({
  ResponsiveDialog: 'ResponsiveDialogMock',
  ResponsiveDialogClose: 'ResponsiveDialogCloseMock',
  ResponsiveDialogContent: 'ResponsiveDialogContentMock',
  ResponsiveDialogDescription: 'ResponsiveDialogDescriptionMock',
  ResponsiveDialogFooter: 'ResponsiveDialogFooterMock',
  ResponsiveDialogHeader: 'ResponsiveDialogHeaderMock',
  ResponsiveDialogTitle: 'ResponsiveDialogTitleMock',
  ResponsiveDialogTrigger: 'ResponsiveDialogTriggerMock',
}));

import * as dialogExports from '../index';

describe('dialogs barrel exports', () => {
  it('re-exports all dialog components and responsive shell helpers', () => {
    expect(dialogExports.AboutDialog).toBe('AboutDialogMock');
    expect(dialogExports.FeedbackDialog).toBe('FeedbackDialogMock');
    expect(dialogExports.KeyboardShortcutsDialog).toBe('KeyboardShortcutsDialogMock');
    expect(dialogExports.StellariumCredits).toBe('StellariumCreditsMock');

    expect(dialogExports.ResponsiveDialog).toBe('ResponsiveDialogMock');
    expect(dialogExports.ResponsiveDialogClose).toBe('ResponsiveDialogCloseMock');
    expect(dialogExports.ResponsiveDialogContent).toBe('ResponsiveDialogContentMock');
    expect(dialogExports.ResponsiveDialogDescription).toBe(
      'ResponsiveDialogDescriptionMock'
    );
    expect(dialogExports.ResponsiveDialogFooter).toBe('ResponsiveDialogFooterMock');
    expect(dialogExports.ResponsiveDialogHeader).toBe('ResponsiveDialogHeaderMock');
    expect(dialogExports.ResponsiveDialogTitle).toBe('ResponsiveDialogTitleMock');
    expect(dialogExports.ResponsiveDialogTrigger).toBe('ResponsiveDialogTriggerMock');
  });
});
