import '@labpics/ui-materials/material.css';
import '@labpics/ui-core/button';
import '@labpics/ui-core/input';
import '@labpics/ui-core/sheet';

const sheet = document.querySelector('lab-sheet');
document.querySelector('#cancel')?.addEventListener('click', () => {
  if (sheet) sheet.open = false;
});
