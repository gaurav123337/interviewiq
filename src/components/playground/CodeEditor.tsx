import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import type { LangId } from '../../data/coding';

type UiPanel = 'html' | 'css' | 'js';
import type { Theme } from '../../services/theme';

/* Language → CodeMirror grammar */
const LANG_EXT: Record<LangId, () => Extension> = {
  python: () => python(),
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  cpp: () => cpp(),
  java: () => java(),
  go: () => go()
};

export function CodeEditor({ value, onChange, lang, theme, className }: {
  value: string;
  onChange: (v: string) => void;
  lang: LangId | UiPanel;
  theme: Theme;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /* create (or recreate) the editor when the language or theme changes */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ext = lang === "html" ? htmlLang() : lang === "css" ? cssLang() : LANG_EXT[lang as LangId]();
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          ext,
          theme === "dark" ? oneDark : [],
          EditorView.updateListener.of(u => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          })
        ]
      })
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, theme]);

  /* push external value changes (reset, language switch) into the editor */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className={className} />;
}

