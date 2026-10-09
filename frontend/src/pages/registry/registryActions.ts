import { toast } from 'sonner';
import { fetchRegistryDownloadLink } from '@/api/registry';
import { openDownload } from '@/lib/files';
import { errorMessage } from '@/lib/queryClient';
import type { Role } from '@/types';

/** Reyestrdan o'chirish — lab_head va admin (D-43, Q-22). */
export const canDeleteFromRegistry = (role?: Role) => role === 'lab_head' || role === 'admin';

export async function downloadRegistryFile(id: string): Promise<void> {
  try {
    openDownload((await fetchRegistryDownloadLink(id)).url);
  } catch (err) {
    toast.error(errorMessage(err));
  }
}
