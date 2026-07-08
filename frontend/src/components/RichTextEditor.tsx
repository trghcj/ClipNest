import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';
import Mention from '@tiptap/extension-mention';
import { suggestion } from './mentionSuggestion';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Undo,
  Redo,
  Code
} from 'lucide-react';
import clsx from 'clsx';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const buttons = [
    {
      icon: Bold,
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      title: 'Bold'
    },
    {
      icon: Italic,
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      title: 'Italic'
    },
    {
      icon: Strikethrough,
      onClick: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
      title: 'Strikethrough'
    },
    {
      icon: Code,
      onClick: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive('code'),
      title: 'Code'
    },
    {
      divider: true
    },
    {
      icon: Heading1,
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
      title: 'Heading 1'
    },
    {
      icon: Heading2,
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
      title: 'Heading 2'
    },
    {
      divider: true
    },
    {
      icon: List,
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      title: 'Bullet List'
    },
    {
      icon: ListOrdered,
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      title: 'Ordered List'
    },
    {
      icon: Quote,
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
      title: 'Blockquote'
    },
    {
      divider: true
    },
    {
      icon: Undo,
      onClick: () => editor.chain().focus().undo().run(),
      isActive: false,
      disabled: !editor.can().chain().focus().undo().run(),
      title: 'Undo'
    },
    {
      icon: Redo,
      onClick: () => editor.chain().focus().redo().run(),
      isActive: false,
      disabled: !editor.can().chain().focus().redo().run(),
      title: 'Redo'
    }
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/30 border-b border-border rounded-t-xl">
      {buttons.map((btn, idx) => {
        if (btn.divider) {
          return <div key={`divider-${idx}`} className="w-px h-6 bg-border mx-1" />;
        }
        const Icon = btn.icon!;
        return (
          <button
            key={btn.title}
            onClick={btn.onClick}
            disabled={btn.disabled}
            title={btn.title}
            className={clsx(
              "p-2 rounded-lg transition-colors flex items-center justify-center",
              btn.isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              btn.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
            )}
            type="button"
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
};

const CustomMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      url: {
        default: null,
        parseHTML: element => element.getAttribute('href'),
        renderHTML: attributes => {
          if (!attributes.url) {
            return {}
          }
          return {
            href: attributes.url,
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        },
      },
    }
  },
})

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder = "Write something amazing..." }) => {
  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    
    if (!cloudName || !uploadPreset) {
      console.error("Cloudinary credentials are not set in environment variables.");
      alert("Image upload failed: Cloudinary is not configured.");
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      return data.secure_url;
    } catch (err) {
      console.error("Cloudinary upload failed", err);
      alert("Failed to upload image.");
      return null;
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Dropcursor,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      CustomMention.configure({
        HTMLAttributes: {
          class: 'mention bg-primary/20 text-primary px-1.5 py-0.5 rounded-md font-medium cursor-pointer hover:bg-primary/30 transition-colors',
        },
        suggestion,
        renderHTML({ node }) {
          return [
            'a',
            {
               class: 'mention bg-primary/20 text-primary px-1.5 py-0.5 rounded-md font-medium cursor-pointer hover:bg-primary/30 transition-colors',
               href: node.attrs.url || '#',
               target: '_blank',
               rel: 'noopener noreferrer'
            },
            `@${node.attrs.label ?? node.attrs.id}`,
          ]
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      // Provide the HTML content to the parent
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-blockquote:my-2 prose-ul:my-1 prose-ol:my-1 prose-img:rounded-lg max-w-none focus:outline-none min-h-[300px] p-4 custom-scrollbar',
      },
      handleDrop: function(view, event, _slice, moved) {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          let file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            uploadImageToCloudinary(file).then(url => {
              if (url) {
                const { schema } = view.state;
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                const node = schema.nodes.image.create({ src: url });
                if (coordinates) {
                  const tr = view.state.tr.insert(coordinates.pos, node);
                  view.dispatch(tr);
                }
              }
            });
            return true;
          }
        }
        return false;
      },
      handlePaste: function(view, event, _slice) {
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files[0]) {
          let file = event.clipboardData.files[0];
          if (file.type.startsWith('image/')) {
            uploadImageToCloudinary(file).then(url => {
              if (url) {
                const { schema } = view.state;
                const node = schema.nodes.image.create({ src: url });
                const tr = view.state.tr.replaceSelectionWith(node);
                view.dispatch(tr);
              }
            });
            return true;
          }
        }
        return false;
      }
    },
  });

  return (
    <div className="flex flex-col border border-border rounded-xl bg-card overflow-hidden">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
};
