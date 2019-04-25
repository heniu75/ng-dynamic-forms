import { Inject, Injectable, Injector, Optional } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { DynamicFormControlModel } from "../model/dynamic-form-control.model";
import { DYNAMIC_MATCHERS, DynamicFormControlMatcher } from "./dynamic-form-relation.matchers";
import {
    AND_OPERATOR,
    DynamicFormControlCondition,
    DynamicFormControlRelation,
    OR_OPERATOR
} from "../model/misc/dynamic-form-control-relation.model";

@Injectable({
    providedIn: "root"
})
export class DynamicFormRelationService {

    constructor(@Optional() @Inject(DYNAMIC_MATCHERS) private DYNAMIC_MATCHERS: DynamicFormControlMatcher[],
                private injector: Injector) {}

    getRelatedFormControl(group: FormGroup, condition: DynamicFormControlCondition): FormControl | never {

        const control = condition.rootPath ?
            group.root.get(condition.rootPath) as FormControl : group.get(condition.id) as FormControl;

        if (control === null) {
            throw new Error(`No related form control with id ${condition.id} could be found`);
        }

        return control;
    }

    getRelatedFormControls(model: DynamicFormControlModel, group: FormGroup): FormControl[] | never {

        const controls: FormControl[] = [];

        model.relations.forEach(relation => relation.when.forEach(condition => {

            if (model.id === condition.id) {
                throw new Error(`FormControl ${model.id} cannot depend on itself`);
            }

            const control = this.getRelatedFormControl(group, condition);

            if (control && !controls.some(controlElement => controlElement === control)) {
                controls.push(control);
            }
        }));

        return controls;
    }

    findRelation(relations: DynamicFormControlRelation[], matcher: DynamicFormControlMatcher): DynamicFormControlRelation | null {

        const relation = relations.find(relation => {
            return relation.match === matcher.match || relation.match === matcher.opposingMatch;
        });

        return relation || null;
    }

    matchesCondition(relation: DynamicFormControlRelation, group: FormGroup, matcher: DynamicFormControlMatcher): boolean {

        const operator = relation.operator || OR_OPERATOR;

        return relation.when.reduce((hasAlreadyMatched: boolean, condition: DynamicFormControlCondition, index: number) => {

            const relatedControl = this.getRelatedFormControl(group, condition);

            if (relatedControl && relation.match === matcher.match) {

                if (index > 0 && operator === AND_OPERATOR && !hasAlreadyMatched) {
                    return false;
                }

                if (index > 0 && operator === OR_OPERATOR && hasAlreadyMatched) {
                    return true;
                }

                return condition.value === relatedControl.value || condition.status === relatedControl.status;
            }

            if (relatedControl && relation.match === matcher.opposingMatch) {

                if (index > 0 && operator === AND_OPERATOR && hasAlreadyMatched) {
                    return true;
                }

                if (index > 0 && operator === OR_OPERATOR && !hasAlreadyMatched) {
                    return false;
                }

                return !(condition.value === relatedControl.value || condition.status === relatedControl.status);
            }

            return false;

        }, false);
    }

    watchRelation(model: DynamicFormControlModel, group: FormGroup, control: FormControl): void {

        if (Array.isArray(this.DYNAMIC_MATCHERS)) {

            this.DYNAMIC_MATCHERS.forEach(matcher => {

                const relation = this.findRelation(model.relations, matcher);

                if (relation) {

                    const hasMatch = this.matchesCondition(relation, group, matcher);
                    matcher.onChange(hasMatch, model, control, this.injector);
                }
            });
        }
    }
}
