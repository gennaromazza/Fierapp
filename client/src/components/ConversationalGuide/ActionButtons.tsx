import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { GuideAction } from './types';

interface ActionButtonsProps {
  actions: GuideAction[];
  className?: string;
}

export function ActionButtons({ actions, className }: ActionButtonsProps) {
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [dateOpen, setDateOpen] = useState<Record<string, boolean>>({});

  const handleInputChange = (actionId: string, value: any) => {
    setInputValues(prev => ({ ...prev, [actionId]: value }));
  };

  const handleActionClick = (action: GuideAction) => {
    const value = inputValues[action.id];
    action.action(value);
    
    // Clear input after action
    setInputValues(prev => ({ ...prev, [action.id]: '' }));
  };

  return (
    <div className={cn("space-y-3", className)}>
      {actions.map((action) => {
        switch (action.type) {
          case 'input':
            return (
              <div key={action.id} className="flex gap-2">
                <Input
                  placeholder={action.label}
                  value={inputValues[action.id] || ''}
                  onChange={(e) => handleInputChange(action.id, e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputValues[action.id]) {
                      handleActionClick(action);
                    }
                  }}
                />
                <Button
                  onClick={() => handleActionClick(action)}
                  disabled={action.required && !inputValues[action.id]}
                  size="sm"
                >
                  Invia
                </Button>
              </div>
            );

          case 'datepicker':
            return (
              <div key={action.id} className="flex gap-2">
                <Popover 
                  open={dateOpen[action.id]} 
                  onOpenChange={(open) => setDateOpen(prev => ({ ...prev, [action.id]: open }))}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !inputValues[action.id] && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {inputValues[action.id] 
                        ? format(inputValues[action.id], "dd/MM/yyyy")
                        : action.label
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={inputValues[action.id]}
                      onSelect={(date) => {
                        handleInputChange(action.id, date);
                        setDateOpen(prev => ({ ...prev, [action.id]: false }));
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={() => handleActionClick(action)}
                  disabled={action.required && !inputValues[action.id]}
                  size="sm"
                >
                  Conferma
                </Button>
              </div>
            );

          case 'checkbox':
            return (
              <div key={action.id} className="flex items-center space-x-2">
                <Checkbox
                  id={action.id}
                  checked={inputValues[action.id] || false}
                  onCheckedChange={(checked) => {
                    handleInputChange(action.id, checked);
                    // Auto-trigger action for checkboxes
                    setTimeout(() => handleActionClick(action), 100);
                  }}
                />
                <label 
                  htmlFor={action.id} 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {action.label}
                </label>
              </div>
            );

          case 'button':
          default:
            return (
              <Button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className="w-full"
                size="sm"
              >
                {action.label}
              </Button>
            );
        }
      })}
    </div>
  );
}