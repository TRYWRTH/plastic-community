CREATE TABLE public.user_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  player_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, player_id)
);

CREATE INDEX idx_user_push_subscriptions_user_id ON public.user_push_subscriptions(user_id);

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push subscriptions"
  ON public.user_push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions"
  ON public.user_push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
  ON public.user_push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
  ON public.user_push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER touch_user_push_subscriptions_updated_at
  BEFORE UPDATE ON public.user_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();