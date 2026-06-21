// Feather/Lucide-style stroke icons — 20×20 rendered, 24×24 viewBox, MIT licensed paths
const i = d =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icons = {
  trash:
    i('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'),

  pencil:
    i('<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>'),

  check:
    i('<polyline points="20 6 9 17 4 12"/>'),

  undo:
    i('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.48"/>'),

  xMark:
    i('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),

  chevronLeft:
    i('<polyline points="15 18 9 12 15 6"/>'),

  chevronRight:
    i('<polyline points="9 18 15 12 9 6"/>'),

  // Filled dots — override the global stroke/fill on individual elements
  dotsVertical:
    i('<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>'),

  dotsHorizontal:
    i('<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>'),

  grip:
    i('<circle cx="8.5" cy="5" r="1.75" fill="currentColor" stroke="none"/><circle cx="8.5" cy="12" r="1.75" fill="currentColor" stroke="none"/><circle cx="8.5" cy="19" r="1.75" fill="currentColor" stroke="none"/><circle cx="15.5" cy="5" r="1.75" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="1.75" fill="currentColor" stroke="none"/><circle cx="15.5" cy="19" r="1.75" fill="currentColor" stroke="none"/>'),

  info:
    i('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),

  link:
    i('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
};
