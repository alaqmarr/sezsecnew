"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  List,
  Quote,
  Image as ImageIcon,
  Link2,
} from "lucide-react";
import { IosSpinner } from "./ios-loader.component";
import { notify } from "./toast.helper";

export function RichEditor({
  label,
  value,
  onChange,
  placeholder = "Write your community chronicle here…",
}: {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;
    if (!initializedRef.current || (value === "" && editorRef.current.innerHTML !== "")) {
      editorRef.current.innerHTML = value;
      initializedRef.current = true;
    }
  }, [value]);

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }

  async function handleInsertImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Image upload failed");
      }
      exec("insertImage", data.url);
      notify.success("Image inserted into chronicle");
    } catch (err) {
      notify.error(
        "Could not insert image",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleInsertLink() {
    const url = window.prompt("Enter link URL (https://...):");
    if (url && url.trim()) {
      exec("createLink", url.trim());
    }
  }

  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="block text-xs font-semibold tracking-wide text-[#3D2E2A]">
          {label}
        </label>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-[#DCD2C2] bg-white focus-within:border-[#6A1B1B] focus-within:ring-2 focus-within:ring-[#6A1B1B]/12">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#EAE2D6] bg-[#FAF7F2] px-2.5 py-1.5">
          <ToolbarBtn onClick={() => exec("bold")} title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => exec("italic")} title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => exec("formatBlock", "H2")}
            title="Section Heading"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => exec("insertUnorderedList")}
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => exec("formatBlock", "BLOCKQUOTE")}
            title="Quote"
          >
            <Quote className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={handleInsertLink} title="Insert Link">
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => fileInputRef.current?.click()}
            title="Upload & Insert Image"
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <IosSpinner size="xs" tone="maroon" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
          </ToolbarBtn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInsertImage}
            className="hidden"
          />
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={(e) => onChange(e.currentTarget.innerHTML)}
          className="chronicle-prose min-h-[260px] w-full px-4 py-3 text-sm text-[#231917] focus:outline-none empty:before:text-[#9E8E85] empty:before:content-[attr(data-placeholder)]"
        />
      </div>
    </div>
  );
}

function ToolbarBtn({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#5E4F4A] hover:bg-[#EAE2D6] hover:text-[#231917] cursor-pointer disabled:opacity-50"
    >
      {children}
    </button>
  );
}
