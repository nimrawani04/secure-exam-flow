import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { PasswordInput } from './PasswordInput';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PasswordResetForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setSuccess(true);
        toast({ title: 'Password updated!', description: 'Your password has been changed successfully.' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <div>
          <h2 className="text-3xl font-bold">Password updated!</h2>
          <p className="text-muted-foreground mt-2">
            Your password has been successfully changed.
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard')} className="w-full h-12">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <KeyRound className="w-8 h-8 text-accent" />
        </div>
      </div>

      <div className="text-center lg:text-left">
        <h2 className="text-3xl font-bold">Set new password</h2>
        <p className="text-muted-foreground mt-2">Enter your new password below</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <PasswordInput
            id="newPassword"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-12"
          />
          <PasswordStrengthIndicator password={password} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="h-12"
          />
        </div>

        <Button type="submit" className="w-full h-12" disabled={isUpdating}>
          {isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Updating password...
            </>
          ) : (
            'Update password'
          )}
        </Button>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to sign in
        </button>
      </div>
    </div>
  );
}
