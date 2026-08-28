import { Component, OnInit } from '@angular/core';
import { UserAuthService } from '../_service/user-auth.service';
import { TranslationService } from '../_service/translation.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  constructor(private userAuthService: UserAuthService, public t: TranslationService) { }

  ngOnInit(): void {
  }

  isLoggedIn(): boolean {
    return !!this.userAuthService.isLoggedIn();
  }

}
