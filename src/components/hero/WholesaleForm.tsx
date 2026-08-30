import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { WholesaleRegistrationModal } from '@/components/wholesale/WholesaleRegistrationModal';

interface WholesaleFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WholesaleForm: React.FC<WholesaleFormProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-30 bg-white animate-fade-in">
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto pt-20">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-display font-bold text-gray-900">
              Wholesale Registration
            </h1>
            <Button 
              onClick={onClose}
              variant="outline" 
              size="lg"
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </div>
          <WholesaleRegistrationModal 
            open={true} 
            onOpenChange={(open) => { if (!open) onClose(); }} 
            diagonal={false} 
          />
        </div>
      </div>
    </div>
  );
};