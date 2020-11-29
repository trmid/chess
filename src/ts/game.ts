/// <reference path="./board.ts" />

var board: Board;

window.onload = function () {

    // Event Listeners
    link_event_listeners();

    // Check for game load
    if (!check_load_game(parse_get_vars())) {

        // Append a default game board
        board = new Board({
            parent_elem: $("#chess-container"),
            tile_onclick: tile_onclick
        });

    }

}

interface GameVars {
    game?: Number
    fen_str?: string
    side?: string
    parent_elem?: JQuery<HTMLElement> | HTMLElement;
}

function parse_get_vars() {
    const url = new URL(location.href);
    const _GET: GameVars = {};

    const game = url.searchParams.get('game');
    if (game)
        _GET.game = parseInt(game);

    let fen_str = url.searchParams.get('fen');
    if (fen_str) fen_str = unescape(fen_str);
    if (fen_str)
        _GET.fen_str = fen_str;

    const side = url.searchParams.get('side');
    if (side)
        _GET.side = side;

    return _GET;

}

function check_load_game(game_vars: GameVars) {
    if (!game_vars) return false;
    game_vars.parent_elem = $("#chess-container");
    if (!game_vars.parent_elem) {
        throw new Error("Chess Container is undefined.");
    }
    board = new Board({
        fen_str: game_vars.fen_str,
        side: game_vars.side == 'b' ? 'b' : 'w',
        parent_elem: game_vars.parent_elem,
        tile_onclick: tile_onclick
    });
    return true;
}

function tile_onclick(tile: JQuery<HTMLElement> | HTMLElement, code: string, x: number, y: number, piece?: Piece) {
    console.log(piece);
    if (piece) {

        // Get Moves
        const moves = piece.get_valid_moves();
        console.log(moves);

        // Remove all highlights
        remove_all_highlights();

        // Add new highlights
        $(tile).addClass('selected');
        moves.forEach(move => {
            let tile_class = "available_move";
            switch (move.type) {
                case 'blocked':
                    tile_class = 'blocked_move';
                    break;
                case 'capture':
                case 'en-passant':
                    tile_class = 'capture_move';
                    break;
                case 'promote_r':
                case 'promote_b':
                case 'promote_n':
                case 'promote_q':
                    tile_class += ' promotion';
                    break;
            }
            $(`td[x=${move.x}][y=${move.y}]`)
                .addClass(tile_class);
        });

    } else if ($(tile).hasClass('available_move') || $(tile).hasClass('capture_move')) {

        const selected = $('.selected');
        console.log(selected);
        const selected_pos = {
            x: parseInt(selected.attr('x') || ""),
            y: parseInt(selected.attr('y') || "")
        };
        const selected_piece = board.piece_at(selected_pos);
        const moves = selected_piece?.get_valid_moves();

        const pos = {
            x: x,
            y: y
        };

        let promotion: string | undefined = undefined;
        if ($(tile).hasClass('promotion')) {
            const options = ['rook', 'bishop', 'knight', 'queen'];
            let choice = "";
            let valid = false;
            while (!valid) {
                choice = window.prompt(`What would you like to promote to? (rook, bishop, knight, queen)`) || "";
                for (let i = 0; i < options.length; i++) {
                    if (choice === options[i]) valid = true;
                }
            }
            switch (choice) {
                case 'rook': promotion = 'promote_r'; break;
                case 'bishop': promotion = 'promote_b'; break;
                case 'knight': promotion = 'promote_n'; break;
                case 'queen': promotion = 'promote_q'; break;
            }
        }

        if (moves) {

            for (let i = 0; i < moves.length; i++) {
                const move = moves[i];
                if (move.x == pos.x && move.y == pos.y && (!promotion || move.type === promotion)) {

                    // Make the move
                    move.execute();

                    // Remove all highlights
                    remove_all_highlights();

                    // Update the URL
                    const url = new URL(location.href);
                    url.searchParams.set('fen', board.get_fen_string());
                    window.history.pushState({}, '', url.toString());

                    // Check game state
                    if (board.is_checkmate()) {
                        window.alert(`${board.turn == 'w' ? 'Black' : 'White'} won by checkmate in ${board.turn_num} turns.`);
                    } else if (board.is_stalemate()) {
                        window.alert(`${board.turn == 'w' ? 'Black' : 'White'} has entered stalemate in ${board.turn_num} turns.`);
                    } else if (board.is_check()) {
                        window.alert(`${board.turn == 'w' ? 'White' : 'Black'} is in check.`);
                    }

                    // Break
                    break;

                }
            }

        }

    } else {

        // Remove all highlights if empty tile selected
        remove_all_highlights();

    }
}

function remove_all_highlights() {
    $('.selected').removeClass('selected');
    $('.blocked_move').removeClass('blocked_move');
    $('.available_move').removeClass('available_move');
    $('.capture_move').removeClass('capture_move');
}

function link_event_listeners() {
    // New Game
    $("#new-game-btn").on("click", () => {
        $("#play-options").toggle("fast");
    });

    // nav toggle
    $("#nav-toggle").on("click", () => {
        $("nav").toggle("fast");
    });

    // PvP
    $("#play-player").on("click", () => {
        window.location.assign("/?game=0");
    });

    // AI Easy
    $("#play-ai-easy").on("click", () => {
        window.location.assign("/?game=1");
    });

    // AI Normal
    $("#play-ai-normal").on("click", () => {
        window.location.assign("/?game=2");
    });

    // AI Hard
    $("#play-ai-hard").on("click", () => {
        window.location.assign("/?game=3");
    });

}