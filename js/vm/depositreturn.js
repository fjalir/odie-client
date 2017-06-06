/*global window*/

import ko from "knockout";

import api from "../api";
import {Filter, SelectableCollection, SubstringFilter} from "../collection";
import Document from "./document";
import log from "./log";
import user from "./user";

export default class DepositReturn {
  constructor() {
    this.filter = new SubstringFilter({column: 'name'});
    this.documentFilter = new SubstringFilter({column: 'submitted_by'});
    this.depositFilter = new SubstringFilter({column: 'name'});

    this.locallyValidatedIDs = [];//ko.observableArray();
    this.documents = new SelectableCollection({
      endpoint: 'documents',
      filters: [
        this.documentFilter,
        new SubstringFilter({column: 'submitted_by', value: ko.getObservable(this.filter, 'value')}),
        new Filter({column: 'submitted_by', operator: '!=', value: null}),
      ],
      sortBy: {column: 'date', asc: false},
      deserialize: data => {
        if(this.locallyValidatedIDs.indexOf(data.id) !== -1) data.validated = true;
        return new Document(data);
      },
    });
    this.deposits = new SelectableCollection({
      endpoint: 'deposits',
      filters: [this.filter, this.depositFilter],
      sortBy: {column: 'date', asc: false},
      deserialize: data => {
        data.date = new Date(data.date);
        return data;
      },
    });
    this.currentSelectionEligibleForRejection = ko.pureComputed(function(){
      // lets not fail the servers delete_document pre-condition
      let selected = this.documents.selected;
      return selected &&
          (selected.early_document_eligible || selected.deposit_return_eligible) && // be still eligible for smth
          (!selected.validated || this.locallyValidatedIDs.indexOf(selected.id) !== -1); // be only locally validated
    }, this);
    this.documentAdminUrl = ko.pureComputed(() => {
      let selected = this.documents.selected;
      return selected && `${api.adminUrl}document/edit/?id=${selected.id}`;
    }, this);
    ko.track(this, ['locallyValidatedIDs']);
  }

  validate(document) {
    window.open(document.previewURL, '_blank');
    if(!document.validated) {
      document.validated = true;
      if(this.locallyValidatedIDs.indexOf(document.id) === -1) this.locallyValidatedIDs.push(document.id);
    }
  }

  _cashOutDeposit() {
    let data = {
      id: this.deposits.selected.id,
      cash_box: user.officeConfig.cash_boxes[0],
    };
    let price = -this.deposits.selected.price
    if (this.documents.selected)
      data.document_id = this.documents.selected.id;

    api.post('log_deposit_return', data).done(() => {
        log.addItem('Pfandrückgabe', price);
        this.documents.load();
        this.deposits.load();
      });
  }

  cashOutDeposit() {
    let selected = this.documents.selected;
    if(selected && selected.validated && this.locallyValidatedIDs.indexOf(selected.id) === -1) {
      this._cashOutDeposit();
    } else {
      $('#validateMetaModal').modal('show');
      $('#confirmActionButton').off().one('click', this._cashOutDeposit.bind(this));
    }
  }

  _cashOutEarlyDocument() {
    let data = {
      id: this.documents.selected.id,
      cash_box: user.officeConfig.cash_boxes[0],
    };

    api.post('log_early_document_reward', data).done((data) => {
      log.addItem('Erstprotokoll', -data.data.disbursal);
      this.documents.load();
    });      
  }

  cashOutEarlyDocument() {
    let selected = this.documents.selected;
    if(selected && selected.validated && this.locallyValidatedIDs.indexOf(selected.id) === -1) {
      this._cashOutEarlyDocument();
    } else {
      $('#validateMetaModal').modal('show');
      $('#confirmActionButton').off().one('click', this._cashOutEarlyDocument.bind(this));
    }
  }

  rejectDocument() {
    api.delete(`documents/${this.documents.selected.id}`).done((data) => {
      log.addItem("Protokoll abgelehnt");
      this.documents.load();
    });
  }

}
