import { Component, OnInit } from '@angular/core';
import { TranslationService } from '../_service/translation.service';

@Component({
  selector: 'app-forbidden',
  templateUrl: './forbidden.component.html',
  styleUrls: ['./forbidden.component.css']
})
export class ForbiddenComponent implements OnInit {

  constructor(public t: TranslationService) { }

  ngOnInit(): void {
  }

}
