export interface StatusCheck {
    context: string;
    state: string;
    created_at: string;
}
export declare function getStatusChecks(): Promise<StatusCheck[]>;
