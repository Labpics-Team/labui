import type * as tagsInputMachine from '@zag-js/tags-input';
export const tagsInputTranslations: Partial<tagsInputMachine.IntlTranslations> = {
  deleteTagTriggerLabel: (value: string) => `Delete ${value}`,
  tagSelected: (value: string) => `${value} selected. Press Backspace or Delete to remove.`,
  tagAdded: (value: string) => `Added tag ${value}`,
  tagsPasted: (values: string[]) => `Pasted ${values.length} tags`,
  tagEdited: (value: string) => `Editing tag ${value}. Press Enter to save or Escape to cancel.`,
  tagUpdated: (value: string) => `Tag updated to ${value}`,
  tagDeleted: (value: string) => `Deleted tag ${value}`,
};
