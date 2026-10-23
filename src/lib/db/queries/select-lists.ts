/**
 * Literal select lists (PostgREST needs literals for type inference).
 * tests/unit/select-lists.test.ts checks each one against TABLE_COLUMNS.
 */
export const PROFILE_COLUMNS = 'id,display_name,locale,time_zone,created_at,updated_at' as const;

export const MAIL_ACCOUNT_COLUMNS =
  'id,user_id,provider,provider_account_id,email_address,display_name,status,connected_at,created_at,updated_at' as const;

export const MESSAGE_LIST_COLUMNS =
  'id,account_id,provider_thread_id,subject,sender_name,sender_address,received_at,is_read,is_flagged,importance,has_attachments' as const;

export const FOLLOW_UP_COLUMNS =
  'id,user_id,message_id,title,note,due_at,status,completed_at,created_at,updated_at' as const;

export const TASK_COLUMNS =
  'id,user_id,source_message_id,title,notes,status,priority,due_at,completed_at,created_at,updated_at' as const;

export const SAVED_VIEW_COLUMNS =
  'id,user_id,name,definition,position,created_at,updated_at' as const;
