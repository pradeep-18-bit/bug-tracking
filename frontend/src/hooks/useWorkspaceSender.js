import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchEligibleSenders,
  fetchWorkspaceSender,
  saveWorkspaceSender,
} from "@/lib/api";

export const useWorkspaceSender = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const workspaceId = user?.workspaceId || "default";
  const userId = user?._id || "anonymous";

  const eligibleSendersQuery = useQuery({
    queryKey: ["eligible-senders", workspaceId],
    queryFn: fetchEligibleSenders,
  });

  const workspaceSenderQuery = useQuery({
    queryKey: ["workspace-sender", workspaceId, userId],
    queryFn: fetchWorkspaceSender,
  });

  const saveWorkspaceSenderMutation = useMutation({
    mutationFn: saveWorkspaceSender,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-sender"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["eligible-senders"],
        }),
      ]);
    },
  });

  return {
    eligibleSendersQuery,
    workspaceSenderQuery,
    saveWorkspaceSenderMutation,
  };
};

export default useWorkspaceSender;
