
-- Create reading_list table to store bookmarked news articles per user
CREATE TABLE public.reading_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  article_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  source_icon TEXT,
  published_at TIMESTAMPTZ,
  category TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, article_id)
);

-- Enable RLS
ALTER TABLE public.reading_list ENABLE ROW LEVEL SECURITY;

-- Users can only see their own bookmarks
CREATE POLICY "Users can view their own reading list"
  ON public.reading_list
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add to their own reading list
CREATE POLICY "Users can insert into their reading list"
  ON public.reading_list
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove from their own reading list
CREATE POLICY "Users can delete from their reading list"
  ON public.reading_list
  FOR DELETE
  USING (auth.uid() = user_id);
