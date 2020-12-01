/// <reference path="./board.ts" />

var board: Board;
var game_mode: number;
var side: 'w' | 'b';

window.onload = function () {

    const _GET = parse_get_vars();

    // Game mode
    game_mode = _GET.game || 0;
    side = _GET.side == 'b' ? 'b' : 'w';

    // Event Listeners
    link_event_listeners();

    // Check for game load
    if (!check_load_game(_GET)) {

        // Append a default game board
        board = new Board({
            parent_elem: $("#chess-container"),
            tile_onclick: tile_onclick
        });

    }

    // Check game state
    check_game_state();

    if (_GET.game == 5) {

        async function ai_vs_ai() {

            // Check game state
            const game_over = check_game_state();
            if (game_over) return;

            const diff = board.turn == 'w' ? 4 : 5;

            const move = await get_ai_move(board, diff);
            highlight_move(move);
            move?.execute(() => {
                // Update URL
                update_url();

                // Call again
                ai_vs_ai();
            });

        }

        ai_vs_ai();

    } else if (_GET.game != 0 && side != board.turn) {

        (async () => {
            const move = await get_ai_move(board, _GET.game);
            highlight_move(move);
            move?.execute(() => {
                // Update URL
                update_url();
            });
        })();

    }

}

interface GameVars {
    game?: number
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

    if (game_mode > 0 && side != board.turn) return; // Return if AI should move

    if (piece) {

        // Get Moves
        const moves = piece.get_valid_moves();

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
                    highlight_move(move);
                    move.execute(() => {

                        // Update the URL
                        update_url();

                        // Check game state
                        const game_over = check_game_state();

                        // Call AI if applicable
                        if (!game_over && game_mode > 0) {

                            setTimeout(async () => {

                                const move = await get_ai_move(board, game_mode);
                                highlight_move(move);
                                move?.execute();

                                // Update URL
                                update_url();

                                // Check game state
                                check_game_state();

                            }, 0);

                        }

                    });

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

function update_url() {
    const url = new URL(location.href);
    url.searchParams.set('fen', board.get_fen_string());
    url.searchParams.set('game', "" + game_mode);
    window.history.pushState({}, '', url.toString());
}

function check_game_state() {
    const checkmate = board.is_checkmate();
    const stalemate = board.is_stalemate();
    const check = board.is_check();
    setTimeout(() => {
        if (checkmate) {
            window.alert(`${board.turn == 'w' ? 'Black' : 'White'} won by checkmate in ${board.turn_num} turns.`);
        } else if (stalemate) {
            window.alert(`${board.turn == 'w' ? 'Black' : 'White'} has entered stalemate in ${board.turn_num} turns.`);
        } else if (check) {
            window.alert(`${board.turn == 'w' ? 'White' : 'Black'} is in check.`);
        }
    }, 0);
    return checkmate || stalemate;
}

function highlight_move(move?: Move) {
    if (move) {
        remove_all_highlights();
        $(`td[x=${move.piece.pos.x}][y=${move.piece.pos.y}]`).addClass('last-position');
        $(`td[x=${move.x}][y=${move.y}]`).addClass('new-position');
    }
}

function remove_all_highlights() {
    $('.selected').removeClass('selected');
    $('.blocked_move').removeClass('blocked_move');
    $('.available_move').removeClass('available_move');
    $('.capture_move').removeClass('capture_move');
    $('.promotion').removeClass('promotion');
    $('.last-position').removeClass('last-position');
    $('.new-position').removeClass('new-position');
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
        window.location.assign(`?game=0&side=${side}`);
    });

    // AI Beginner
    $("#play-ai-beginner").on("click", () => {
        window.location.assign(`?game=1&side=${side}`);
    });

    // AI Easy
    $("#play-ai-easy").on("click", () => {
        window.location.assign(`?game=2&side=${side}`);
    });

    // AI Normal
    $("#play-ai-normal").on("click", () => {
        window.location.assign(`?game=3&side=${side}`);
    });

    // AI Hard
    $("#play-ai-hard").on("click", () => {
        window.location.assign(`?game=4&side=${side}`);
    });

    // Undo
    $("#undo").on("click", () => {
        window.history.back();
    });

    // Redo
    $("#redo").on("click", () => {
        window.history.forward();
    });

    // Side Button
    $("#side-btn").on("click", (e) => {
        side = $(e.delegateTarget).attr('side') == 'w' ? 'b' : 'w';
        $(e.delegateTarget)
            .attr('side', side)
            .css('background-color', side == 'w' ? 'white' : 'black')
            .css('color', side == 'w' ? 'black' : 'white')
            .html(side == 'w' ? "Play as <strong>Black</strong>" : "Play as <strong>White</strong>");
    });

    window.onpopstate = () => {
        window.location.reload();
    }

}

async function get_ai_move(board: Board, difficulty = 1, depth?: number): Promise<Move | undefined> {

    // Allow breathing room for UI events
    await new Promise(resolve => {
        setTimeout(() => {
            resolve('resolved');
        }, 5);
    });

    // Declare Vars
    const side = board.turn;
    console.log(side);
    const value_mult = (side == 'w' ? 1 : -1);
    const moves = board.get_executable_moves();
    if (moves.length == 0) return undefined;

    // Select difficulty
    switch (difficulty) {
        case 5: {
            const move_data = new Array<{ move: Move, value: number, following_move?: Move, following_result?: Board, result: Board }>();
            const initial_depth = 1;
            if (depth === undefined) depth = initial_depth;
            for (let i = 0; i < moves.length; i++) {

                // Similar to 3
                let result = moves[i].get_result();
                let following_move = undefined;
                let following_result = undefined;
                if (depth > 0) {
                    following_move = await get_ai_move(result, difficulty, 0);
                    if (following_move) {
                        result = following_move.get_result();
                        following_result = result;
                    }
                }
                const value = result.get_value(true) * value_mult;

                // Store for ranking
                move_data.push({ move: moves[i], value: value, result: result, following_move: following_move, following_result: following_result });

            }

            // Sort moves
            const sorted_moves = move_data.sort((a, b) => b.value - a.value);
            const pool_size = depth == initial_depth ? Math.min(sorted_moves.length, 16) : (1 + depth);
            let best = undefined;
            let max = -Infinity;
            if (sorted_moves.length > 0) {
                for (let b = 0; b < Math.min(sorted_moves.length, pool_size); b++) {
                    const move = sorted_moves[b].move;
                    const result = sorted_moves[b].following_result || sorted_moves[b].result;
                    let value = sorted_moves[b].value;
                    if (depth > 0) {
                        const updated_move = await get_ai_move(result, difficulty, depth - 1);
                        if (updated_move) {
                            const updated_result = updated_move.get_result();
                            value = updated_result.get_value(true) * value_mult;
                        }
                    }
                    if (value > max || (value == max && Math.random() <= 0.2)) {
                        max = value;
                        best = move;
                    }
                }
            } else {
                return undefined;
            }
            if (!best) {
                console.log("no best move, returning random...");
                return get_ai_move(board, 1); // return random if there was no best move
            }
            if (depth == initial_depth) {
                console.log(`AI ${difficulty} best move [turn=${board.turn_num}] for ${board.turn}:`, max, best);
            }
            return best;
        }
        case 4: {
            const move_data = new Array<{ move: Move, value: number }>();
            if (depth === undefined) depth = 1;
            let best = undefined;
            let max = -Infinity;
            for (let i = 0; i < moves.length; i++) {
                let result = moves[i].get_result();
                if (depth > 0) {
                    const opposing_move = await get_ai_move(result, difficulty, depth - 1);
                    if (opposing_move) {
                        result = opposing_move.get_result();
                    }
                }
                const value = result.get_value(true) * value_mult;
                move_data.push({ move: moves[i], value: value });
                if (value > max || (value == max && Math.random() <= (2.0 / moves.length))) {
                    max = value;
                    best = moves[i];
                }
                if (moves[i].type.slice(5) === 'promo') {
                    console.log(moves[i], value, move_data, best, max);
                }
            }
            if (depth == 1) {
                // console.log(move_data);
                console.log(`AI ${difficulty} best move [turn=${board.turn_num}] for ${board.turn}:`, max, best);
            }
            if (!best) {
                console.log("no best move, returning random...");
                return get_ai_move(board, 1); // return random if there was no best move
            }
            return best;
        }
        case 3: {
            const move_data = new Array<{ move: Move, value: number }>();
            if (depth === undefined) depth = 1;
            let best = undefined;
            let max = -Infinity;
            for (let i = 0; i < moves.length; i++) {
                let result = moves[i].get_result();
                if (depth > 0) {
                    const opposing_move = await get_ai_move(result, difficulty, depth - 1);
                    if (opposing_move) {
                        result = opposing_move.get_result();
                    }
                }
                const value = result.get_value() * value_mult;
                move_data.push({ move: moves[i], value: value });
                if (value > max || (value == max && Math.random() <= (2.0 / moves.length))) {
                    max = value;
                    best = moves[i];
                }
            }
            if (depth == 1) {
                // console.log(move_data);
                console.log(`AI ${difficulty} best move [turn=${board.turn_num}] for ${board.turn}:`, max, best);
            }
            if (!best) {
                console.log("no best move, returning random...");
                return get_ai_move(board, 1); // return random if there was no best move
            }
            return best;
        }
        case 2: {
            let best = random_move(moves);
            if (!best) return undefined;
            let max = best.get_result().get_value() * value_mult;
            for (let i = 0; i < moves.length; i++) {
                const value = moves[i].get_result().get_value() * value_mult;
                console.log(moves[i], value);
                if (value > max) {
                    max = value;
                    best = moves[i];
                }
            }
            return best;
        }
        case 1:
        default:
            return random_move(moves);
    }
}

function random_move(moves: Move[]) {
    if (moves.length == 0) return undefined;
    return moves[Math.floor(Math.random() * moves.length)];
}