import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Color } from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  ImageIcon,
  Undo,
  Redo,
  Sparkles,
  Highlighter,
  Palette,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FONTS = ["Arial", "Helvetica", "Georgia", "Times New Roman", "Courier New", "Verdana"];
const SIZES = ["12px", "14px", "16px", "18px", "20px", "24px"];
const COLORS = ["#0F172A", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899"];

export interface RichEmailEditorHandle {
  insertText: (text: string) => void;
  getHtml: () => string;
}

export function RichEmailEditor({
  value,
  onChange,
  registerInsert,
}: {
  value: string;
  onChange: (html: string) => void;
  registerInsert?: (fn: (text: string) => void) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      TextStyle,
      Color,
      FontFamily,
      Highlight,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[260px] px-4 py-3 text-sm leading-relaxed",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor && registerInsert) {
      registerInsert((text: string) => {
        editor.chain().focus().insertContent(text).run();
      });
    }
  }, [editor, registerInsert]);

  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt("URL");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt("Image URL");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="flex items-center flex-wrap gap-0.5 border-b border-border px-2 py-1.5 bg-secondary/30">
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="h-3.5 w-3.5" />
        </ToolBtn>
        <Sep />
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <Sep />
        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>
        <Sep />
        <ToolBtn onClick={setLink} title="Link">
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={addImage} title="Image">
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <Sep />
        <Select
          defaultValue="Arial"
          onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}
        >
          <SelectTrigger className="h-7 w-[110px] text-xs border-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          defaultValue="14px"
          onValueChange={(v) => {
            // FontSize requires a custom extension; emulate via inline span style.
            editor.chain().focus().setMark("textStyle", { style: `font-size: ${v}` }).run();
          }}
        >
          <SelectTrigger className="h-7 w-[80px] text-xs border-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIZES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ColorPicker
          icon={<Palette className="h-3.5 w-3.5" />}
          title="Text color"
          onPick={(c) => editor.chain().focus().setColor(c).run()}
        />
        <ColorPicker
          icon={<Highlighter className="h-3.5 w-3.5" />}
          title="Highlight color"
          onPick={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()}
        />
        <Sep />
        <ToolBtn
          onClick={() => toast("AI grammar check lands next pass.")}
          title="AI grammar check"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </ToolBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition",
        active && "bg-secondary text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-5 bg-border mx-0.5" />;
}

function ColorPicker({
  icon,
  title,
  onPick,
}: {
  icon: React.ReactNode;
  title: string;
  onPick: (color: string) => void;
}) {
  return (
    <div className="relative group">
      <ToolBtn onClick={() => {}} title={title}>
        {icon}
      </ToolBtn>
      <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-wrap gap-1 p-1.5 bg-popover border border-border rounded-md shadow-md z-20 w-[120px]">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className="h-4 w-4 rounded border border-border"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
