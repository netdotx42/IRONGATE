"use client";
import * as Dialog from "@radix-ui/react-dialog";
export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal">
          <div className="row between">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="button ghost" aria-label="Close dialog">
              ×
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {title} options and information
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
