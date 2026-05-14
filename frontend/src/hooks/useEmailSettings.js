import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchEmailConfig,
  saveEmailConfig,
  testEmailConfig,
} from "@/lib/api";

export const useEmailSettings = (userId, options = {}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const workspaceId = user?.workspaceId || "default";
  const queryEnabled =
    typeof options.enabled === "boolean" ? options.enabled : Boolean(userId);

  const emailConfigQuery = useQuery({
    queryKey: ["email-config", workspaceId, userId],
    queryFn: () => fetchEmailConfig(userId),
    enabled: queryEnabled && Boolean(userId),
  });

  const saveEmailConfigMutation = useMutation({
    mutationFn: saveEmailConfig,
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["email-config", workspaceId, variables?.userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["eligible-senders", workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-sender", workspaceId],
        }),
      ]);
    },
  });

  const testEmailConfigMutation = useMutation({
    mutationFn: testEmailConfig,
  });

  return {
    emailConfigQuery,
    saveEmailConfigMutation,
    testEmailConfigMutation,
  };
};

export default useEmailSettings;
