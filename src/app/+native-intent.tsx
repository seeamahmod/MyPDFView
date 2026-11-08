// Routes "Open with → MyPDF View" (content:// or file:// PDFs) and files shared
// to the app into the /incoming screen, which imports them.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/^(content|file):\/\//i.test(path)) return `/incoming?uri=${encodeURIComponent(path)}`;
    if (/expo-sharing|share/i.test(path)) return '/incoming?share=1';
    return path;
  } catch {
    return '/';
  }
}
