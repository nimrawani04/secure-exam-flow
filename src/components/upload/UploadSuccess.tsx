import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface UploadSuccessProps {
  onUploadAnother: () => void;
}

export function UploadSuccess({ onUploadAnother }: UploadSuccessProps) {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-success" />
      </div>
      <h1 className="text-3xl font-bold mb-4">Paper Uploaded Successfully!</h1>
      <p className="text-muted-foreground mb-8">
        Your paper has been submitted for HOD review. 
        You'll receive a notification once it's reviewed.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" onClick={onUploadAnother}>
          Upload Another
        </Button>
        <Link to="/dashboard">
          <Button variant="hero">View Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
