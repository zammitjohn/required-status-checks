export interface StatusCheck {
    context: string;
    state: string;
    created_at: string;
    target_url: string | null;
}
export declare function getStatusChecks(): Promise<StatusCheck[]>;
