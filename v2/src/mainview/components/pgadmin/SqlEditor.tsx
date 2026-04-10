import CodeMirror from '@uiw/react-codemirror';

import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  className?: string;
}

export function SqlEditor({
  value,
  onChange,
  onExecute,
  className,
}: SqlEditorProps) {
  return (
    <div className={className} style={{ height: '100%', overflow: 'hidden' }}>
      <CodeMirror
        value={value}
        height="100%"
        extensions={[sql()]}
        theme={oneDark}
        onChange={onChange}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            onExecute?.();
          }
        }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          searchKeymap: true,
        }}
        style={{ height: '100%', fontSize: '13px' }}
      />
    </div>
  );
}
