/*global window*/

import ko from "knockout";

import api from "../api";
import Document from "./document";

export default class DocumentReporting {
  constructor() {
    let self = this;
    this.id_or_barcode = null;
    this.reason = null;
    this.status = null;
    this.submissionEnabled = ko.pureComputed(function(){
      return self.status == null;
    },this);

    ko.track(this);
    ko.getObservable(this, 'reason').subscribe(function(changes) {
      self.status = null;
    });
    ko.getObservable(this, 'id_or_barcode').subscribe(function(changes) {
      self.status = null;
    });
  }

  reportDocument() {
    let data = {
      id: this.id_or_barcode,
      reason: this.reason
    };

    this.status = 'waiting';
    api.post('document_report', data, {error: (data) => {
      this.status = 'error';
      let responseJson = JSON.parse(data.responseText);
      let error = responseJson.errors[0];
      if(error == 'document not found')
        this.status = '404';
      if(error == 'no reason')
        this.status = '400';
    }}).done(() => {
      this.status = 'success';
    });
  }
}
