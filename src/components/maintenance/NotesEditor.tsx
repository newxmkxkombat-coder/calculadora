import React, { useEffect, useRef } from 'react';

interface NotesEditorProps {
  initialHtml: string;
  onChange: (html: string) => void;
}

const COLORS = [
  { value: '#ffffff', title: 'Blanco', className: 'bg-white' },
  { value: '#2dd4bf', title: 'Turquesa', className: 'bg-teal-400' },
  { value: '#f59e0b', title: 'Amarillo', className: 'bg-amber-500' },
  { value: '#ef4444', title: 'Rojo', className: 'bg-red-500' },
  { value: '#10b981', title: 'Verde', className: 'bg-emerald-500' },
];

const toolButton = 'px-2.5 py-1 rounded-md text-xs border border-line/70 bg-card text-main hover:bg-raised active:scale-95 transition-all cursor-pointer';

/** Editor de notas con negrita, subrayado, cursiva y colores. */
export const NotesEditor: React.FC<NotesEditorProps> = ({ initialHtml, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
  }, [initialHtml]);

  const emitChange = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const applyStyle = (command: string, value = '') => {
    document.execCommand(command, false, value);
    emitChange();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 bg-field border border-line/70 border-b-0 rounded-t-xl p-2">
        <button type="button" onClick={() => applyStyle('bold')} className={`${toolButton} font-bold`} title="Negrita">B</button>
        <button type="button" onClick={() => applyStyle('underline')} className={`${toolButton} underline`} title="Subrayado">S</button>
        <button type="button" onClick={() => applyStyle('italic')} className={`${toolButton} italic`} title="Cursiva">I</button>
        <div className="h-4 w-px bg-line mx-1" />
        <span className="text-[10px] text-muted uppercase tracking-wider mr-1">Color</span>
        {COLORS.map(color => (
          <button
            key={color.value}
            type="button"
            onClick={() => applyStyle('foreColor', color.value)}
            className={`w-5 h-5 rounded-full border border-line cursor-pointer ${color.className}`}
            title={color.title}
          />
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={emitChange}
        onBlur={emitChange}
        className="rich-editor w-full bg-field/60 border border-line/70 rounded-b-xl p-3 text-main min-h-[150px] max-h-[300px] focus:outline-none focus:border-brand overflow-y-auto text-sm"
        placeholder="Añade una nota con estilos aquí..."
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
};
