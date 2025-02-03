export interface StatusCheck {
    context: string;
    state: string;
    description: string;
}
export declare function getStatusChecks(): Promise<StatusCheck[]>;
