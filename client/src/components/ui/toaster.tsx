import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast 
            key={id} 
            {...props} 
            className="bg-brand-primary border-brand-accent text-brand-text-primary shadow-lg"
            style={{ 
              backgroundColor: 'var(--brand-primary)',
              borderColor: 'var(--brand-accent)',
              color: 'var(--brand-text-primary)'
            }}
          >
            <div className="grid gap-1">
              {title && <ToastTitle className="text-brand-text-primary font-semibold">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-brand-text-secondary">{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className="text-brand-text-secondary hover:text-brand-text-primary" />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
