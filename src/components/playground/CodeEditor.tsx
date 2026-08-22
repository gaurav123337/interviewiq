import { memo } from "react";
import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
/* CodeMirror language packs — lazy-loaded to keep the Playground chunk small */
import type { LangId } from '../../data/coding';

type UiPanel = 'html' | 'css' | 'js';
import type { Theme } from '../../services/theme';

/* Language → CodeMirror grammar (dynamically imported). */
const LANG_EXT: Record<LangId, () => Extension> = {
  python: () => import('@codemirror/lang-python').then(m => m.python()),
  javascript: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  typescript: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  cpp: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  java: () => import('@codemirror/lang-java').then(m => m.java()),
  go: () => import('@codemirror/lang-go').then(m => m.go())
};

export const CodeEditor = memo(function CodeEditor({ value, onChange, lang, theme, className }: {
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
});

