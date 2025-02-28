import * as ko from "knockout";
import * as validation from "knockout.validation";
import template from "./change-password.html";
import { Component, RuntimeComponent, OnMounted, Param } from "@paperbits/common/ko/decorators";
import { EventManager } from "@paperbits/common/events";
import { ChangePasswordRequest } from "../../../../../contracts/resetRequest";
import { BackendService } from "../../../../../services/backendService";
import { UsersService } from "../../../../../services";
import { CaptchaData } from "../../../../../models/captchaData";
import { dispatchErrors, parseAndDispatchError } from "../../../validation-summary/utils";
import { ErrorSources } from "../../../validation-summary/constants";

@RuntimeComponent({
    selector: "change-password-runtime"
})
@Component({
    selector: "change-password-runtime",
    template: template
})
export class ChangePassword {
    public readonly password: ko.Observable<string>;
    public readonly newPassword: ko.Observable<string>;
    public readonly passwordConfirmation: ko.Observable<string>;
    public readonly isChangeConfirmed: ko.Observable<boolean>;
    public readonly working: ko.Observable<boolean>;
    public readonly captcha: ko.Observable<string>;
    
    public setCaptchaValidation: (captchaValidator: ko.Observable<string>) => void;
    public refreshCaptcha: () => Promise<void>;
    public readonly captchaData: ko.Observable<CaptchaData>;

    constructor(
        private readonly usersService: UsersService,
        private readonly eventManager: EventManager,
        private readonly backendService: BackendService
    ) {
        this.password = ko.observable();
        this.newPassword = ko.observable();
        this.passwordConfirmation = ko.observable();
        this.isChangeConfirmed = ko.observable(false);
        this.working = ko.observable(false);
        this.captcha = ko.observable();
        this.requireHipCaptcha = ko.observable();
        this.captchaData = ko.observable();

        validation.init({
            insertMessages: false,
            errorElementClass: "is-invalid",
            decorateInputElement: true
        });

        this.password.extend(<any>{ required: { message: `Password is required.` } }); // TODO: password requirements should come from Management API.
        this.newPassword.extend(<any>{ required: { message: `New password is required.` }, minLength: 8 }); // TODO: password requirements should come from Management API.
        this.passwordConfirmation.extend(<any>{ required: { message: `Password confirmation is required.` }, equal: { message: "Password confirmation field must be equal to new password.", params: this.newPassword } });
        this.captcha.extend(<any>{ required: { message: `Captcha is required.` } });
    }

    @Param()
    public requireHipCaptcha: ko.Observable<boolean>;

    /**
     * Initializes component right after creation.
     */
    @OnMounted()
    public async initialize(): Promise<void> {
        const isUserSignedIn = await this.usersService.isUserSignedIn();

        if (!isUserSignedIn) {
            this.usersService.navigateToHome();
            return;
        }
    }
    
    public onCaptchaCreated(captchaValidate: (captchaValidator: ko.Observable<string>) => void, refreshCaptcha: () => Promise<void>) {
        this.setCaptchaValidation = captchaValidate;
        this.refreshCaptcha = refreshCaptcha;
    }

    /**
     * Sends user change password request to Management API.
     */
    public async changePassword(): Promise<void> {
        const isCaptcha = this.requireHipCaptcha();
        const validationGroup = {
            password: this.password,
            newPassword: this.newPassword,
            passwordConfirmation: this.passwordConfirmation
        };

        if (isCaptcha) {
            validationGroup["captcha"] = this.captcha;
            this.setCaptchaValidation(this.captcha);
        }

        const result = validation.group(validationGroup);

        const clientErrors = result();

        if (clientErrors.length > 0) {
            result.showAllMessages();
            dispatchErrors(this.eventManager, ErrorSources.changepassword, clientErrors);
            return;
        }

        const user = await this.usersService.getCurrentUser();
        const credentials = `Basic ${btoa(`${user.email}:${this.password()}`)}`;
        let userId = await this.usersService.authenticate(credentials);

        if (!userId) {
            dispatchErrors(this.eventManager, ErrorSources.changepassword, ["Incorrect user name or password"]);
            return;
        }

        userId = `/users/${userId}`;

        try {
            this.working(true);
            dispatchErrors(this.eventManager, ErrorSources.changepassword, []);

            if (isCaptcha) {
                const captchaRequestData = this.captchaData();
                const resetRequest: ChangePasswordRequest = {
                    challenge: captchaRequestData.challenge,
                    solution: captchaRequestData.solution?.solution,
                    flowId: captchaRequestData.solution?.flowId,
                    token: captchaRequestData.solution?.token,
                    type: captchaRequestData.solution?.type,
                    userId: userId,
                    newPassword: this.newPassword()
                };
                await this.backendService.sendChangePassword(resetRequest);
            } else {
                await this.usersService.changePassword(userId, this.newPassword());
            }
            this.isChangeConfirmed(true);
        } catch (error) {
            if (isCaptcha) {
                await this.refreshCaptcha();
            }

            parseAndDispatchError(this.eventManager, ErrorSources.changepassword, error, undefined, detail => `${detail.target}: ${detail.message} \n`);
        } finally {
            this.working(false);
        }
    }
}
