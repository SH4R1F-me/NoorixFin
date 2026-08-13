-- First-class tag management and canonical identity.
--
-- Tags used to be created only as a side effect of posting a transaction. The
-- original UNIQUE(workspace_id, name) is case-sensitive, so "Travel" and
-- "travel" could become separate filters. Canonical lowercase names make a
-- tag's identity match what the UI has always communicated.

UPDATE public.tags
   SET name = 'tag-' || left(id::text, 8)
 WHERE btrim(name) = '';

DO $$
DECLARE
  duplicate_group RECORD;
BEGIN
  FOR duplicate_group IN
    SELECT workspace_id,
           lower(btrim(name)) AS canonical_name,
           min(id::text)::uuid AS canonical_id
      FROM public.tags
     GROUP BY workspace_id, lower(btrim(name))
    HAVING count(*) > 1
  LOOP
    INSERT INTO public.journal_entry_tags (journal_entry_id, tag_id, workspace_id)
    SELECT links.journal_entry_id,
           duplicate_group.canonical_id,
           links.workspace_id
      FROM public.journal_entry_tags links
      JOIN public.tags tag ON tag.id = links.tag_id
     WHERE tag.workspace_id = duplicate_group.workspace_id
       AND lower(btrim(tag.name)) = duplicate_group.canonical_name
       AND tag.id <> duplicate_group.canonical_id
    ON CONFLICT DO NOTHING;

    DELETE FROM public.tags tag
     WHERE tag.workspace_id = duplicate_group.workspace_id
       AND lower(btrim(tag.name)) = duplicate_group.canonical_name
       AND tag.id <> duplicate_group.canonical_id;
  END LOOP;
END;
$$;

UPDATE public.tags SET name = lower(btrim(name));

ALTER TABLE public.tags
  ADD CONSTRAINT tags_name_not_blank CHECK (btrim(name) <> ''),
  ADD CONSTRAINT tags_name_length CHECK (char_length(name) <= 40),
  ADD CONSTRAINT tags_name_canonical CHECK (name = lower(btrim(name)));

CREATE UNIQUE INDEX idx_tags_workspace_canonical_name
  ON public.tags(workspace_id, lower(btrim(name)));
