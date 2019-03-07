//<script>

/* returns a jquery deferred object, .done() means an invite was sent (or attempted), .fail() indicates they dismissed the modal */
function PresentGroupInviteOptions( rgFriendsToInvite )
{
	// this deferred will succeed if an invite is succesfully sent, fail if the user dismisses the modal or the invite AJAX fails
	var deferred = new jQuery.Deferred();

	var Modal = ShowDialog( 'Пригласить в группу', '<div class="group_invite_throbber"><img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>' );
	var $ListElement = $J('<div/>', {'class': 'newmodal_content_innerbg'} );

	var bBulkFriendInvite = false;
	var steamIDInvitee = g_rgProfileData['steamid'];
	var strProfileURL = g_rgProfileData['url'];

	// see if this is a request to bulk invite a group of friends
	if ( rgFriendsToInvite && rgFriendsToInvite instanceof Array )
	{
		if ( rgFriendsToInvite.length == 1 )
		{
			steamIDInvitee = rgFriendsToInvite[0];
			strProfileURL = 'https://steamcommunity.com/profiles/' + steamIDInvitee + '/';
		}
		else
		{
			// true bulk invite
			steamIDInvitee = rgFriendsToInvite;
			bBulkFriendInvite = true;
		}
	}

	// if the modal is dismissed , we'll cancel the deferred object.  We capture this in a closure so that we can dismiss the modal without affecting
	//	the deferred object if the user actually picks something (in which case the deferred object will be the success of the AJAX invite action)
	var fnOnModalDismiss = function() { deferred.reject() };

	$J.get( strProfileURL + 'ajaxgroupinvite?new_profile=1' + ( bBulkFriendInvite ? '&bulk=1' : '' ), function( html ) {
		Modal.GetContent().find( '.newmodal_content').html('');	// erase the throbber
		Modal.GetContent().find( '.newmodal_content').append( $ListElement );
		$ListElement.html( html );
		Modal.AdjustSizing();
		$ListElement.children( '.group_list_results' ).children().each( function () {
			var groupid = this.getAttribute( 'data-groupid' );
			if ( groupid )
			{
				$J(this).click( function() {
					fnOnModalDismiss = function () {;};	// don't resolve the deferred on modal dismiss anymore, user has picked something
					InviteUserToGroup( Modal, groupid, steamIDInvitee)
					.done( function() { deferred.resolve(); } )
					.fail( function() { deferred.reject(); } );
				} );
			}
		});
	});

	Modal.done( function() {fnOnModalDismiss();} );

	return deferred.promise();
}

function InviteUserToGroup( Modal, groupID, steamIDInvitee )
{
	var params = {
		json: 1,
		type: 'groupInvite',
		group: groupID,
		sessionID: g_sessionID
	};

	if ( !steamIDInvitee.length )
	{
		ShowAlertDialog( 'Ошибка', 'Вы никого не выбрали.' );
		return;
	}

	if ( steamIDInvitee instanceof Array )
		params.invitee_list = V_ToJSON( steamIDInvitee );
	else
		params.invitee = steamIDInvitee;

	return $J.ajax( { url: 'https://steamcommunity.com/actions/GroupInvite',
		data: params,
		type: 'POST'
	} ).done( function( data ) {
		Modal && Modal.Dismiss();

		var strMessage = 'Приглашение отправлено!';
		if ( steamIDInvitee instanceof Array && steamIDInvitee.length > 1 )
			strMessage = 'Приглашения отправлены!';

		ShowAlertDialog( 'Пригласить в группу', strMessage );
	}).fail( function( data ) {
		Modal && Modal.Dismiss();

		var rgResults = data.responseJSON;

		var strModalTitle = 'Не удалось отправить приглашение';
        var strAccountListModal = '<div class="ctnClanInviteErrors">';
        strAccountListModal += rgResults.results ? rgResults.results : 'Произошла ошибка при обработке вашего запроса. Пожалуйста, повторите попытку.';
		if ( rgResults.rgAccounts )
		{
			strAccountListModal += '<div class="ctnClanInviteErrors"><table class="clanInviteErrorTable" ><thead><tr><th class="inviteTablePersona" >Пользователь</th><th class="inviteTableError">Ошибка</th></tr></thead><tbody>';
			var cAccounts = 0;
			$J.each( rgResults.rgAccounts, function( accountid, rgError ){
				strAccountListModal += '<tr>';
				strAccountListModal += '<td class="inviteTablePersona ellipsis">' + rgError.persona + '</td>';
				strAccountListModal += '<td class="inviteTableError">' + rgError.strError + "</td>";
				strAccountListModal += '</tr>';

                if ( typeof SelectNone != 'undefined' )
                {
	                SelectNone();
	                $J( '#fr_' + accountid ).addClass( 'groupInviteFailed' );
                }

				cAccounts++;
			} );
			strAccountListModal += '</tbody></table>';

            if ( cAccounts > 1 )
	            strModalTitle = 'Не удалось отправить приглашения';

		}
		strAccountListModal +='</div>';
		ShowAlertDialog( strModalTitle, strAccountListModal );
	});
}

function RemoveFriend()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( 'Удалить из друзей',
		'Вы действительно хотите удалить %s из вашего списка друзей?'.replace( /%s/, strPersonaName ),
		'Удалить из друзей'
	).done( function() {
		$J.post(
			'https://steamcommunity.com/actions/RemoveFriendAjax',
			{sessionID: g_sessionID, steamid: steamid }
		).done( function() {
			ShowAlertDialog( 'Удалить из друзей',
				'%s больше не в списке ваших друзей.'.replace( /%s/, strPersonaName )
			).done( function() {
				// reload the page when they click OK, so we update friend state
				window.location.reload();
			} );
		} ).fail( function() {
			ShowAlertDialog( 'Удалить из друзей',
				'Произошла ошибка при обработке вашего запроса. Пожалуйста, повторите попытку.'
			);
		} );
	} );
}

function CancelInvite()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( 'Отменить приглашение',
	'Вы уверены, что хотите отменить приглашение?<br>Вы не сразу сможете отправить его ещё раз. Если вы знакомы с этим пользователем лично, просто отправьте ему <a href="https://steamcommunity.com/my/friends/add" target="_blank" rel="noreferrer">эту ссылку с приглашением в друзья</a>.',
	'Отменить приглашение'
	).done( function() {
		$J.post(
			'https://steamcommunity.com/actions/RemoveFriendAjax',
			{sessionID: g_sessionID, steamid: steamid }
		).done( function() {
			ShowAlertDialog( 'Отменить приглашение',
				'Вы отменили приглашение в друзья пользователя %s.'.replace( /%s/, strPersonaName )
		).done( function() {
				// reload the page when they click OK, so we update friend state
				window.location.reload();
			} );
		} ).fail( function() {
			ShowAlertDialog( 'Отменить приглашение',
				'Произошла ошибка при обработке вашего запроса. Пожалуйста, повторите попытку.'
		);
		} );
	} );
}

// also used for accepting friend invites
function AddFriend( bRespondingToInvite, steamid_friend, strPersonaName_friend )
{
	var steamid = steamid_friend ? steamid_friend : g_rgProfileData['steamid'];
	var strPersonaName = strPersonaName_friend ? strPersonaName_friend : g_rgProfileData['personaname'];

	$J.post(
		'https://steamcommunity.com/actions/AddFriendAjax',
		{sessionID: g_sessionID, steamid: steamid, accept_invite: bRespondingToInvite ? 1 : 0 }
	).done( function() {
		if ( !bRespondingToInvite )
		{
			ShowAlertDialog( 'Добавить в друзья' + ' - ' + strPersonaName,
				'Приглашение отправлено. Приняв его, пользователь появится в вашем списке друзей.'
			).done( function() { window.location.reload(); } );
		}
		else
		{
			ShowAlertDialog( 'Принять запрос дружбы',
				'Предложение дружбы принято'
			).done( function() { window.location.reload(); } );
		}
	} ).fail( function( jqXHR  ) {

		var failedInvites = jqXHR.responseJSON['failed_invites_result'];

		if ( failedInvites === undefined )
		{
			ShowAlertDialog( 'Добавить в друзья',
				'При добавлении в друзья произошла ошибка. Пожалуйста, попробуйте еще раз.'
			);
			return;
		}

		// defaults
		var strTitle = 'Добавить в друзья';
		var strMessage = 'При добавлении в друзья произошла ошибка. Пожалуйста, попробуйте еще раз.';

		switch ( failedInvites[0] )
		{
			case 25:
				strMessage = 'Невозможно добавить %s. Ваш список друзей переполнен.';
				break;

			case 15:
				strMessage = 'Невозможно добавить %s. Список друзей этого пользователя переполнен.';
				break;

			case 40:
				strMessage = 'Возникла ошибка при добавлении друга. Общение между вами и этим пользователем заблокировано.';
				break;

			case 11:
				strMessage = 'Вы добавили этого пользователя в чёрный список. Чтобы снова связаться с ним, откройте его профиль в сообществе Steam и удалите его из чёрного списка.';
				break;

			case 84:
				strMessage = 'Похоже, вы пригласили в друзья слишком много пользователей. Чтобы предотвратить спам, вы не сможете добавлять друзей некоторое время. При этом другие пользователи по-прежнему могут отправлять вам приглашения.';
				break;

			case 24:
				strMessage = 'Ваш аккаунт не отвечает необходимым требованиям для использования этой функции. Подробности на сайте <a class="whiteLink" href="https://help.steampowered.com/ru/wizard/HelpWithLimitedAccount" target="_blank" rel="noreferrer">службы поддержки Steam</a>.';
				break;

			default:
				// default text is above
				break;
		}

		strMessage = strMessage.replace( /%s/, strPersonaName );
		ShowAlertDialog( strTitle, strMessage );

	} );
}

// ignore an invite; do not block the inviter
function IgnoreFriendInvite( steamid_friend, strPersonaName_friend )
{
	var steamid = steamid_friend ? steamid_friend : g_rgProfileData['steamid'];
	var strPersonaName = strPersonaName_friend ? strPersonaName_friend : g_rgProfileData['personaname'];

	$J.post(
		'https://steamcommunity.com/actions/IgnoreFriendInviteAjax',
		{sessionID: g_sessionID, steamid: steamid }
	).done( function() {
		ShowAlertDialog( 'Игнорировать приглашение в друзья',
			'Предложение дружбы отклонено'
		).done( function() { window.location.reload(); } );
	} ).fail( function() {
		ShowAlertDialog( 'Игнорировать приглашение в друзья',
			'Ошибка при попытке проигнорировать приглашение. Пожалуйста, попробуйте ещё раз.'
		);
	} );
}

// block a user, with confirmation
function ConfirmBlock()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( 'Добавить в чёрный список',
		'Вы собираетесь добавить пользователя %s в чёрный список.'.replace( /%s/, strPersonaName ),
		'Да, добавить в чёрный список'
	).done( function() {
			$J.post(
				'https://steamcommunity.com/actions/BlockUserAjax',
				{sessionID: g_sessionID, steamid: steamid, block: 1 }
			).done( function() {
				ShowAlertDialog( 'Добавить в чёрный список',
					'Вы добавили этого пользователя в чёрный список.'
				).done( function() {
					location.reload();
				} );
			} ).fail( function() {
				ShowAlertDialog( 'Добавить в чёрный список',
					'Произошла ошибка при обработке вашего запроса. Пожалуйста, повторите попытку.'
				);
			} );
		} );
}

// unblock a user, with confirmation
function ConfirmUnblock()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( 'Удалить из чёрного списка',
	'Вы собираетесь удалить пользователя %s из чёрного списка.'.replace( /%s/, strPersonaName ),
	'Да, удалить из чёрного списка'
).done( function() {
	$J.post(
		'https://steamcommunity.com/actions/BlockUserAjax',
		{sessionID: g_sessionID, steamid: steamid, block: 0 }
	).done( function() {
		ShowAlertDialog( 'Удалить из чёрного списка',
			'Вы удалили этого пользователя из чёрного списка.'
		).done( function() {
			location.reload();
		} );
	} ).fail( function() {
		ShowAlertDialog( 'Удалить из чёрного списка',
			'Произошла ошибка при обработке вашего запроса. Пожалуйста, повторите попытку.'
		);
	} );
} );
}

function InitProfileSummary( strSummary )
{
	var $Summary = $J( '.profile_summary' );
	var $SummaryFooter = $J( '.profile_summary_footer' );

	if ( $Summary[0].scrollHeight <= 76 )
	{
		$Summary.addClass( 'noexpand' );
		$SummaryFooter.hide();
	}
	else
	{
		var $ModalSummary = $J('<div/>', {'class': 'profile_summary_modal'}).html( strSummary );
		$SummaryFooter.find( 'span' ).click( function() {
			var Modal = ShowDialog( 'Подробнее', $ModalSummary );
			window.setTimeout( function() { Modal.AdjustSizing(); }, 1 );
		} );
	}

}

function ShowFriendsInCommon( unAccountIDTarget )
{
	ShowPlayerList( 'Общие друзья', 'friendsincommon', unAccountIDTarget );
}

function ShowFriendsInGroup( unClanIDTarget )
{
	ShowPlayerList( 'Друзья в группе', 'friendsingroup', unClanIDTarget );
}

function ShowPlayerList( title, type, unAccountIDTarget, rgAccountIDs )
{
	var Modal = ShowAlertDialog( title, '<div class="group_invite_throbber"><img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>' );
	var $ListElement = $J('<div/>', {'class': 'player_list_ctn'} );
	var $Buttons = Modal.GetContent().find('.newmodal_buttons').detach();

	Modal.GetContent().css( 'min-width', 268 );

	var rgParams = {};
	if ( type )
		rgParams['type'] = type;
	if ( unAccountIDTarget )
		rgParams['target'] = unAccountIDTarget;
	if ( rgAccountIDs )
		rgParams['accountids'] = rgAccountIDs.join( ',' );

	$J.get( 'https://steamcommunity.com/actions/PlayerList/', rgParams, function( html ) {

		$ListElement.html( html );

		var $Content = Modal.GetContent().find( '.newmodal_content');
		$Content.html(''); // erase the throbber
		$Content.append( $ListElement );
		$Content.append( $Buttons );

		Modal.AdjustSizing();
		$ListElement.append();
	});
}

function ToggleManageFriends()
{
	if ( $J('#manage_friends_actions_ctn').is( ':hidden' ) )
	{
		$J('#manage_friends_btn').find( '.btn_details_arrow').removeClass( 'down').addClass( 'up' );
		$J('#manage_friends_actions_ctn').slideDown( 'fast' );
		$J('div.manage_friend_checkbox').show();
		$J('a.friendBlockLinkOverlay' ).on( 'click.manage_friends', function( event ) {
			if ( !event.which || event.which == 1 )
			{
				event.preventDefault();
				$J(this ).siblings('.manage_friend_checkbox' ).find('input[type=checkbox]' ).prop( 'checked', function( i, v ) { return !v; } );
			}
		});
	}
	else
	{
		$J('#manage_friends_btn').find( '.btn_details_arrow').removeClass( 'up').addClass( 'down' );
		$J('#manage_friends_actions_ctn').slideUp( 'fast' );
		$J('div.manage_friend_checkbox').hide();
		$J('a.friendBlockLinkOverlay' ).off( 'click.manage_friends' );
	}
}

function ManageFriendsInviteToGroup( $Form, groupid )
{
	$Form.find('input[type="checkbox"]');
	var rgFriendSteamIDs = [];
	$Form.find( 'input[type=checkbox]' ).each( function() {
		if ( this.checked )
			rgFriendSteamIDs.push( $J(this).attr( 'data-steamid' ) );
	} );
	if ( rgFriendSteamIDs.length > 0 )
	{
		if ( groupid )
		{
			// specific group
			InviteUserToGroup( null /* no modal window */, groupid, rgFriendSteamIDs ).done( function() {
				$Form.find('input[type=checkbox]').prop( 'checked', false );
			});
		}
		else
		{
			// ask the user which group to invite to
			PresentGroupInviteOptions( rgFriendSteamIDs).done( function() {
				$Form.find('input[type=checkbox]').prop( 'checked', false );
			});
		}
	}
	else
	{
		ShowAlertDialog( 'Пригласить в группу', 'Вы не выбрали ни одного друга.' );
	}
}

function ManageFriendsExecuteBulkAction( $Form, strActionName )
{
	if ( $Form.find('input[type=checkbox]:checked').length == 0 )
	{
		ShowAlertDialog( '', 'Вы не выбрали ни одного друга.' );
		return;
	}

	$Form.find('input[name=action]').val( strActionName );
	$Form.submit();
}

function ManageFriendsConfirmBulkAction( $Form, strActionName, strTitle, strSingluarDescription, strPluralDescription )
{
	var cFriendsSelected = $Form.find('input[type=checkbox]:checked').length;
	if ( cFriendsSelected == 0 )
	{
		ShowAlertDialog( strTitle, 'Вы не выбрали ни одного друга.' );
		return;
	}

	var strDescription = strSingluarDescription;
	if ( cFriendsSelected != 1 )
		strDescription = strPluralDescription.replace( /%s/, cFriendsSelected );

	ShowConfirmDialog( strTitle, strDescription).done( function() {
		ManageFriendsExecuteBulkAction( $Form, strActionName );
	});
}

function ManageFriendsBlock( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'ignore', 'Заблокировать',
		'Вы уверены, что хотите добавить этого друга в чёрный список?' + ' ' + 'Вы больше не сможете обмениваться сообщениями или приглашениями с ним.',
		'Вы уверены, что хотите добавить этих друзей (%s) в чёрный список?' + ' ' + 'Вы больше не сможете обмениваться сообщениями или приглашениями с ними.');
}

function ManageFriendsRemove( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'remove', 'Удалить из друзей',
		'Вы уверены, что хотите удалить этого друга?' + ' ' + 'Этот игрок больше не будет отображаться в списке ваших друзей, и вы не сможете общаться с ним.',
		'Вы уверены, что хотите удалить этих %s друзей?' + ' ' + 'Эти игроки больше не будут отображаться в списке ваших друзей, и вы не сможете общаться с ними.');
}

function ManageFollowingRemove( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'removefollowing', 'Убрать из ваших подписок?',
		'Вы действительно хотите отписаться от этого человека?',
		'Вы уверены, что хотите отписаться от пользователей (%s)?');
}

function ManageFriendsAddFriends( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'addfriend', 'Добавить в друзья',
		'Вы действительно хотите отправить приглашение в друзья выбранным пользователям? ',
		'Вы действительно хотите отправить приглашение в друзья выбранным пользователям? '	);
}



var AliasesLoaded = false;
function ShowAliasPopup(e)
{
	ShowMenu( e, 'NamePopup', 'left' );

	if( AliasesLoaded )
		return true;

	var aliasContainer = $( 'NamePopupAliases' );

	var throbber = document.createElement( 'img' );
	throbber.src = 'https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif';
	aliasContainer.appendChild( throbber );

	new Ajax.Request( g_rgProfileData['url'] + 'ajaxaliases/', {
		method: 'post',
		parameters: { },
		onSuccess: function( transport ) {

			var Aliases = transport.responseJSON;

			if( !aliasContainer )
				return;

			aliasContainer.update('');

			if( !Aliases || Aliases.length == 0 )
				Aliases.push( {newname: "У этого пользователя не было других псевдонимов"} );
			else
				$( 'NamePopupClearAliases' ).show();

			for( var x=0; x<Aliases.length; x++ )
			{
				var c = Aliases[x];

				var curSpan = document.createElement( 'p' );
				var curATN = document.createTextNode( c['newname'] );
				curSpan.appendChild( curATN );
				aliasContainer.appendChild( curSpan );
			}

			AliasesLoaded = true;
		},
		onFailure: function( transport ) { alert( 'Please try again later' ); }
	} );
}

function ShowClearAliasDialog()
{
	ShowConfirmDialog( 'Очистить историю имён', 'Вы уверены, что хотите очистить историю имён? Это может вызвать сложности как у тех, кто недавно играл с вами, так и у тех, кто может не узнать вас в своём списке друзей.' )
		.done( function() {
			$J.ajax( {
				url: g_rgProfileData['url'] + 'ajaxclearaliashistory/',
				data: { sessionid: g_sessionID },
				type: 'POST',
				dataType: 'json'
			}).done( function( data ) {
				if ( data.success != 1 )
				{
					ShowAlertDialog( '', 'Произошла ошибка при обработке вашего запроса. Пожалуйста, повторите попытку.' );
				}
				else
				{
					location.reload();
				}
			}).fail( function( data ) {
				ShowAlertDialog( '', 'Произошла ошибка при обработке вашего запроса. Пожалуйста, повторите попытку.' );
			})
		} );
}

function IsValidNickname( str )
{
	return str.length == 0 || str.strip().length > 2;
}

function ShowNicknameModal( )
{
	// Show the dialogue
	ShowPromptDialog( "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043d\u0438\u043a", "\u041f\u0440\u0438\u0441\u0432\u043e\u0439\u0442\u0435 \u044d\u0442\u043e\u043c\u0443 \u0438\u0433\u0440\u043e\u043a\u0443 \u043f\u043e\u0441\u0442\u043e\u044f\u043d\u043d\u044b\u0439 \u043d\u0438\u043a, \u0447\u0442\u043e\u0431\u044b \u043d\u0435 \u0437\u0430\u0431\u044b\u0442\u044c, \u043a\u0442\u043e \u044d\u0442\u043e.", "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c", "\u041e\u0442\u043c\u0435\u043d\u0430" )
		.done( function( nickname, other ) {
			// User clicked 'OK', so we have a value; need to send it to the server
			$J.ajax( { url: g_rgProfileData['url'] + "ajaxsetnickname/",
				data: { nickname: nickname, sessionid: g_sessionID },
				type: 'POST',
				dataType: 'json'
			} ).done( function( data ) {
				// Got request result back, show it on the page
				if(data.nickname != undefined && data.nickname.length > 0)
				{
					$target = $J('.persona_name .nickname');
					// Add the nickname element if we don't already have one.
					if( $target.length == 0 )
						$target = $J('<span class="nickname"></span>').insertBefore( '.namehistory_link' );

					$target.text( "(" + data.nickname + ") " );
					$target.show();
				} else
					$J('.persona_name .nickname').hide();

			}).fail( function( data ) {
				ShowAlertDialog( '', data.results ? data.results : 'Произошла ошибка при обработке вашего запроса. Пожалуйста, повторите попытку.' );
			});

		}
	);
}

function SetFollowing( bFollowing, fnOnSuccess )
{
	var url = bFollowing ? g_rgProfileData['url'] + "followuser/" : g_rgProfileData['url'] + "unfollowuser/";
	$J.ajax( { url: url,
		data: { sessionid: g_sessionID },
		type: 'POST',
		dataType: 'json'
	} ).done( function( data ) {
		fnOnSuccess( bFollowing );
	}).fail( function( data ) {
		ShowAlertDialog( '', data.results ? data.results : 'Произошла ошибка при обработке вашего запроса. Пожалуйста, повторите попытку.' );
	});
}


function ShowFriendSelect( title, fnOnSelect )
{
	var Modal = ShowAlertDialog( title, '<div class="group_invite_throbber"><img src="https://steamcommunity-a.akamaihd.net/public/images/login/throbber.gif"></div>', 'Отмена' );
	var $ListElement = $J('<div/>', {'class': 'player_list_ctn'} );
	var $Buttons = Modal.GetContent().find('.newmodal_buttons').detach();

	Modal.GetContent().css( 'min-width', 268 );

	var rgParams = {type: 'friends'};

	$J.get( 'https://steamcommunity.com/actions/PlayerList/', rgParams, function( html ) {

		$ListElement.html( html );

		$ListElement.find( 'a' ).remove();
		$ListElement.find( '[data-miniprofile]').each( function() {
			var $El = $J(this);
			$El.click( function() {  Modal.Dismiss(); fnOnSelect( $El.data('miniprofile') ); } );
		} );

		var $Content = Modal.GetContent().find( '.newmodal_content');
		$Content.html(''); // erase the throbber
		$Content.append( $ListElement );
		$Content.append( $Buttons );

		Modal.AdjustSizing();
	});
}

function StartTradeOffer( unAccountID, rgParams )
{
	var params = rgParams || {};
	params['partner'] = unAccountID;
	ShowTradeOffer( 'new', params );
}

function CancelTradeOffer( tradeOfferID )
{
	ShowConfirmDialog(
		'Отменить предложение обмена',
		'Вы уверены, что хотите отменить это предложение обмена?',
		'Да',
		'Нет'
	).done( function() {
		ActOnTradeOffer( tradeOfferID, 'cancel', 'Предложение обмена отменено', 'Отменить предложение обмена' );
	} );
}

function DeclineTradeOffer( tradeOfferID )
{
	ShowConfirmDialog(
		'Отклонить обмен',
		'Вы уверены, что хотите отклонить это предложение обмена? Вы можете изменить его содержимое и отправить встречное предложение.',
		'Отклонить обмен',
		null,
		'Встречное предложение'
	).done( function( strButton ) {
		if ( strButton == 'OK' )
			ActOnTradeOffer( tradeOfferID, 'decline', 'Обмен отклонён', 'Отклонить обмен' );
		else
			ShowTradeOffer( tradeOfferID, {counteroffer: 1} );
	} );
}

function ActOnTradeOffer( tradeOfferID, strAction, strCompletedBanner, strActionDisplayName )
{
	var $TradeOffer = $J('#tradeofferid_' + tradeOfferID);
	$TradeOffer.find( '.tradeoffer_footer_actions').hide();

	return $J.ajax( {
		url: 'https://steamcommunity.com/tradeoffer/' + tradeOfferID + '/' + strAction,
		data: { sessionid: g_sessionID },
		type: 'POST',
		crossDomain: true,
		xhrFields: { withCredentials: true }
	}).done( function( data ) {
		AddTradeOfferBanner( tradeOfferID, strCompletedBanner, false );

		RefreshNotificationArea();
	}).fail( function() {
		ShowAlertDialog( strActionDisplayName, 'Во время изменения этого предложения обмена произошла ошибка. Пожалуйста, повторите попытку позже.' );
		$TradeOffer.find( '.tradeoffer_footer_actions').show();
	});
}

function AddTradeOfferBanner( tradeOfferID, strCompletedBanner, bAccepted )
{
	var $TradeOffer = $J('#tradeofferid_' + tradeOfferID);
	$TradeOffer.find( '.tradeoffer_footer_actions').hide();
	$TradeOffer.find( '.link_overlay' ).hide();
	$TradeOffer.find( '.tradeoffer_items_ctn').removeClass( 'active' ).addClass( 'inactive' );

	var $Banner = $J('<div/>', {'class': 'tradeoffer_items_banner' } );
	if ( bAccepted )
		$Banner.addClass( 'accepted' );

	$Banner.text( strCompletedBanner );
	$TradeOffer.find( '.tradeoffer_items_rule').replaceWith( $Banner );
}

