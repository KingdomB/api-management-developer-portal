import * as ko from "knockout";
import { Parameter } from "../parameter";

export class ConsoleHeader {
    public readonly name: ko.Observable<string>;
    public readonly value: ko.Observable<string>;
    public readonly readonly: boolean;
    public readonly custom: boolean;
    public readonly options: string[];
    public inputTypeValue: ko.Observable<string>;
    public required: boolean;
    public secret: boolean;
    public revealed: ko.Observable<boolean>;
    public description: string;
    public type: string;
    public hiddenValue: ko.Computed<string>;

    public toggleRevealed(): void {
        this.revealed(!this.revealed());
        this.inputTypeValue(this.secret && !this.revealed() ? "password" : "text");
    }

    public canRename(): boolean {
        return !this.required && this.custom;
    }

    constructor(contract?: Parameter) {
        this.name = ko.observable();
        this.value = ko.observable();
        this.revealed = ko.observable(false);
        this.inputTypeValue = ko.observable("text");
        this.options = [];
        this.required = false;
        this.readonly = false;
        this.custom = true;
        this.type = "string";
        this.description = "Additional header.";
        this.hiddenValue = ko.computed<string>(() => this.value()?.replace(/./g, "•"));

        this.revealed.subscribe(() => {
            this.inputTypeValue(this.secret && !this.revealed() ? "password" : "text");
        });

        this.name.extend(<any>{ required: { message: `Name is required.` } });

        if (this.required) {
            this.value.extend(<any>{ required: { message: `Value is required.` } });
        }

        if (!contract) {
            return;
        }

        this.custom = false;
        this.name(contract.name);
        this.value(contract.defaultValue);
        this.required = contract.required;
        this.options = contract.values;
        this.description = contract.description ? contract.description : "";
        this.type = contract.type;
        this.secret = false;
        this.inputTypeValue(this.secret && !this.revealed() ? "password" : "text");
    }
}