
/// <reference path="./piece.ts" />

interface Board {
    turn: 'w' | 'b'
    side: 'w' | 'b'
    piece_set_name: string
    halfturn_num: number
    turn_num: number
    castles: {
        K: boolean
        Q: boolean
        k: boolean
        q: boolean
    }
    king: { 'w'?: King, 'b'?: King }
    board_elem?: HTMLTableElement | JQuery<HTMLTableElement>
    tiles: Array<Array<Piece | undefined>>
    pieces: { 'w': Array<Piece>, 'b': Array<Piece> }
    en_passant?: TilePos
    no_moves?: boolean
    checkmate?: boolean
    stalemate?: boolean
    fen_cache?: { fen_str: string, turn: 'w' | 'b', turn_num: number }
    tile_onclick?: (tile: JQuery<HTMLElement> | HTMLElement, tile_code: string, x: number, y: number, piece?: Piece) => void
}

class Board implements Board {

    /**
     * STATIC VARS
     */

    static START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';



    /**
     * Evaluates if the position is on the board and returns true or false
     */

    static in_bounds(pos: TilePos) {
        return (pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8);
    }



    /**
     * Converts a coordinate position to a standard notation
     */

    static get_tile_code(pos: TilePos) {
        return `${String.fromCharCode(('a').charCodeAt(0) + pos.x)}${pos.y + 1}`;
    }



    /**
     * Converts standard tile location to coordinates
     */

    static get_coord(tile_code: string) {
        return {
            x: tile_code.charCodeAt(0) - ('a').charCodeAt(0),
            y: parseInt(tile_code.charAt(1)) - 1
        };
    }


    /**
     * CONSTRUCTOR
     */

    constructor({
        fen_str = Board.START_FEN,
        side = 'w',
        parent_elem,
        tile_onclick
    }: {
        fen_str?: string
        side?: 'w' | 'b'
        parent_elem?: HTMLElement | JQuery<HTMLElement>
        tile_onclick?: (tile: JQuery<HTMLElement> | HTMLElement, tile_code: string, x: number, y: number, piece?: Piece) => void
    }) {

        // Set vars
        this.turn = 'w';
        this.side = side;
        this.piece_set_name = "kiffset_light";
        this.king = { 'w': undefined, 'b': undefined };
        this.tile_onclick = tile_onclick;

        // Append Board
        if (parent_elem) {
            $(parent_elem).html("");
            this.append_to(parent_elem);
        }

        // Setup the board
        this.load_fen(fen_str);

    }

    load_fen(fen_str: string) {

        const args = fen_str.split(' ');
        const ranks = args[0].split('/');
        this.turn = args[1] == 'b' ? 'b' : 'w';
        this.castles = {
            K: args[2].includes('K'),
            Q: args[2].includes('Q'),
            k: args[2].includes('k'),
            q: args[2].includes('q')
        }
        this.en_passant = Board.get_coord(args[3]);
        this.turn_num = parseInt(args[4]);
        this.halfturn_num = parseInt(args[5]);

        // Create the tile arrays
        this.tiles = new Array<Array<Piece | undefined>>(8);
        for (let i = 0; i < 8; i++) {
            this.tiles[i] = new Array<Piece | undefined>(8);
        }


        // Create the piece arrays
        this.pieces = {
            'w': new Array<Piece>(),
            'b': new Array<Piece>()
        };

        // Place the pieces
        for (let rank = 0; rank < ranks.length; rank++) {

            let file = 0;
            let char_num = 0;
            while (file < 8) {
                const char = ranks[7 - rank].charAt(char_num);
                const blank_spaces = parseInt(char);
                if (!isNaN(blank_spaces)) {
                    file += blank_spaces;
                } else {
                    let piece: Piece | undefined = undefined;
                    const type = char.toUpperCase();
                    const side = type === char ? 'w' : 'b';
                    switch (type) {
                        case 'P':
                            piece = new Pawn(file, rank, side, this);
                            break;
                        case 'R':
                            piece = new Rook(file, rank, side, this);
                            break;
                        case 'N':
                            piece = new Knight(file, rank, side, this);
                            break;
                        case 'B':
                            piece = new Bishop(file, rank, side, this);
                            break;
                        case 'Q':
                            piece = new Queen(file, rank, side, this);
                            break;
                        case 'K':
                            const king = new King(file, rank, side, this);
                            this.king[side] = king;
                            piece = king;
                            break;
                    }
                    if (!piece) {
                        throw new Error(`Piece type [${char}] is not a valid FEN piece code`);
                    }
                    file++;
                }
                char_num++;
            }

        }

        // Save to fen cache
        this.save_fen_cache(fen_str);

    }

    save_fen_cache(fen_str: string) {
        this.fen_cache = {
            fen_str: fen_str,
            turn: this.turn,
            turn_num: this.turn_num
        };
    }

    append_to(elem: HTMLElement | JQuery<HTMLElement>) {

        const board = $(document.createElement("table")).addClass("chess-board");
        this.board_elem = board;

        $(elem).append(board);
        for (let row = 1; row <= 8; row++) {
            const tr = $(document.createElement("tr"));
            if (this.side == 'w') {
                board.prepend(tr);
            } else {
                board.append(tr);
            }
            for (let col = 0; col < 8; col++) {
                const char = String.fromCharCode(('A').charCodeAt(0) + col);
                const tile = $(document.createElement("td"))
                    .attr("tile", `${char}${row}`)
                    .attr("x", col)
                    .attr("y", row - 1)
                    .addClass(((row % 2) + col) % 2 == 0 ? "white-tile" : "black-tile")
                    .on("click", (e) => {
                        const code = `${char}${row}`;
                        const x = col;
                        const y = row - 1;
                        const piece = this.has_piece_at({ x: col, y: row - 1 }, this.turn);
                        if (this.tile_onclick) tile_onclick(e.delegateTarget, code, x, y, piece);
                    });
                if (this.side == 'w') {
                    tr.append(tile);
                } else {
                    tr.prepend(tile);
                }
                // Row Labels
                if (col == 0) {
                    tile.append(
                        $(document.createElement("div"))
                            .addClass("row-label")
                            .html("" + row)
                    );
                }
                // Col Labels
                if (row == 1) {
                    tile.append(
                        $(document.createElement("div"))
                            .addClass(`col-label-${this.side}`)
                            .html("" + char)
                    );
                }
            }
        }
        return board;

    }

    has_piece_at(pos: TilePos, color?: string) {
        const piece = this.piece_at(pos);
        if (piece instanceof Piece) {
            if (color) {
                if (piece.color == color) {
                    return piece;
                } else {
                    return undefined;
                }
            } else {
                return piece;
            }
        } else {
            return undefined;
        }
    }

    piece_at(pos: TilePos) {
        return this.tiles[pos.x][pos.y];
    }

    remove_piece(piece: Piece) {
        const idx = this.pieces[piece.color].findIndex(p => p == piece);
        delete this.pieces[piece.color][idx];
        this.tiles[piece.pos.x][piece.pos.y] = undefined;
        piece.elem?.remove();
    }

    refresh() {
        this.fen_cache = undefined;
        this.get_fen_string();
    }

    has_enpassant_at(pos: TilePos, color?: string) {
        if (this.en_passant && this.en_passant.x == pos.x && this.en_passant.y == pos.y) {
            const en_passant_piece = this.en_passant.y == 2 ?
                this.piece_at({ x: this.en_passant.x, y: 3 }) :
                this.piece_at({ x: this.en_passant.x, y: 4 });
            if (!en_passant_piece) throw new Error("No Piece at expected en passant position.");
            if (color) {
                if (en_passant_piece.color == color) {
                    return en_passant_piece;
                } else {
                    return undefined;
                }
            } else {
                return en_passant_piece;
            }
        } else {
            return undefined;
        }
    }

    place_piece_at(piece: Piece, pos: TilePos) {
        if (piece.elem) {
            $(`td[x=${pos.x}][y=${pos.y}]`).append(piece.elem);
        }
    }

    get_fen_string() {

        // Check cache
        if (this.fen_cache && this.fen_cache.turn == this.turn && this.fen_cache.turn_num == this.turn_num) {
            return this.fen_cache.fen_str;
        }

        // Generate fen string
        let fen = "";

        for (let rank = 7; rank >= 0; rank--) {
            let file = 0;
            let blank = 0;
            while (file < 8) {
                const piece = this.piece_at({ x: file, y: rank });
                if (piece) {
                    if (blank > 0) {
                        fen += blank;
                        blank = 0;
                    }
                    if (piece instanceof Pawn) {
                        fen += piece.color === 'w' ? 'P' : 'p';
                    } else if (piece instanceof Rook) {
                        fen += piece.color === 'w' ? 'R' : 'r';
                    } else if (piece instanceof Knight) {
                        fen += piece.color === 'w' ? 'N' : 'n';
                    } else if (piece instanceof Bishop) {
                        fen += piece.color === 'w' ? 'B' : 'b';
                    } else if (piece instanceof Queen) {
                        fen += piece.color === 'w' ? 'Q' : 'q';
                    } else if (piece instanceof King) {
                        fen += piece.color === 'w' ? 'K' : 'k';
                    }
                } else {
                    blank++;
                }
                file++;
            }
            if (blank > 0) {
                fen += blank;
                blank = 0;
            }
            if (rank > 0) fen += "/";
        }

        // Turn
        fen += ` ${this.turn}`;

        // Castles
        let castles = `${this.castles.K ? 'K' : ''}${this.castles.k ? 'k' : ''}${this.castles.Q ? 'Q' : ''}${this.castles.q ? 'q' : ''}`;
        if (castles.length == 0) {
            castles = '-';
        }
        fen += ` ${castles}`;

        // En Passant
        if (this.en_passant) {
            fen += ` ${Board.get_tile_code(this.en_passant)}`;
        } else {
            fen += ` -`;
        }

        // Turn Number
        fen += ` ${this.turn_num}`;

        // Halfturn Number
        fen += ` ${this.halfturn_num}`;

        // Save to fen cache
        this.save_fen_cache(fen);

        return fen;
    }

    get_moves(valid = true, side?: 'w' | 'b') {
        let moves = new Array<Move>();
        const pieces = this.pieces[side ?? this.turn];
        pieces.forEach(piece => {
            moves = moves.concat(valid ? piece.get_valid_moves() : piece.get_moves());
        });
        return moves;
    }

    get_executable_moves() {
        const moves = this.get_moves();
        const exe_moves = new Array<Move>();
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            if (move.type !== 'blocked') {
                exe_moves.push(move);
            }
        }
        return exe_moves;
    }

    calculate_check(side?: 'w' | 'b') {
        const offence = side ?? (this.turn == 'w' ? 'b' : 'w');
        const defence = offence == 'w' ? 'b' : 'w';
        const moves = this.get_moves(false, offence);
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            if (move.type !== 'blocked' && move.captured_piece == this.king[defence]) {
                return true;
            }
        }
        return false;
    }

    is_check(side?: 'w' | 'b') {
        let actual_turn = this.turn;
        if (side) {
            this.turn = (side == 'w' ? 'b' : 'w'); // opposite just because we usually calculate check after a move is made
        }
        const check = BoardStateManager.is_check(this);
        this.turn = actual_turn;
        return check;
    }

    is_checkmate() {
        return BoardStateManager.is_checkmate(this);
    }

    is_stalemate() {
        return BoardStateManager.is_stalemate(this);
    }

    has_no_moves() {
        const defence_moves = this.get_moves(true, this.turn);

        // Check if there are any available valid moves
        for (let i = 0; i < defence_moves.length; i++) {
            if (defence_moves[i].type !== 'blocked') {
                return false;
            }
        }

        return true;
    }


    /**
     * Positive value is advantage for white, negative is advantage for black
     */
    get_value(advanced?: boolean) {
        const checkmate = BoardStateManager.is_checkmate(this);
        const stalemate = BoardStateManager.is_stalemate(this);
        if (checkmate) return this.turn == 'b' ? Infinity : -Infinity;

        // Calculate piece values remaining
        let val = 0;
        this.pieces.w.forEach(piece => {
            if (!(piece instanceof King)) {
                val += piece.get_worth();
            }
        });
        this.pieces.b.forEach(piece => {
            if (!(piece instanceof King)) {
                val -= piece.get_worth();
            }
        });

        if (advanced) {
            // + points for each castling position in the early game
            const castle_points = 0.25;
            const early_game = this.pieces.b.length + this.pieces.w.length > 20;
            if (early_game) {
                val += (this.castles.K ? castle_points : 0);
                val += (this.castles.Q ? castle_points : 0);
                val -= (this.castles.k ? castle_points : 0);
                val -= (this.castles.q ? castle_points : 0);
            }

            // Points for various options
            const capture_multiplier = 0.05;
            const castle_move_points = 0.1;
            const promotion_points = 0.25;
            const move_points = 0.01;
            var king_moves = { w: 0, b: 0 };
            const moves = this.get_moves(false, 'w').concat(this.get_moves(false, 'b'));
            for (let i = 0; i < moves.length; i++) {
                const move = moves[i];
                if (move.type !== 'blocked') {
                    // Points for having a move
                    val += move_points * (move.piece.color == 'w' ? 1 : -1);

                    // Keep track of how many king moves
                    if (move.piece instanceof King) {
                        king_moves[move.piece.color]++;
                    }

                    if (move.captured_piece) {
                        // points for each possible capture position
                        val += move.captured_piece.get_worth() * capture_multiplier * (move.captured_piece.color == 'w' ? -1 : 1);
                    }
                    switch (move.type) {
                        case 'promotion_q':
                        case 'promotion_r':
                        case 'promotion_b':
                        case 'promotion_n':
                            val += promotion_points * (move.piece.color == 'w' ? 1 : -1);
                            break;
                        case 'castle':
                            if (early_game) {
                                val += castle_move_points * (move.piece.color == 'w' ? 1 : -1);
                            }
                            break;
                    }
                }
            }

            // Points for the King having at least 3 moves of escape
            const king_escape_points = 0.5;
            val += (king_moves.w >= 3 ? king_escape_points : 0) - (king_moves.b >= 3 ? king_escape_points : 0);

        }

        // Return absolute advantage to losing side if stalemate
        if (stalemate) {
            return -val * Infinity;
        }

        return val;
    }

}

interface BoardState {
    fen_str: string
    is_check: boolean
    calculated: boolean
    is_checkmate?: boolean
    is_stalemate?: boolean
}

class BoardStateManager {

    static STATES = new Map<string, BoardState>();

    static is_check(board: Board) {
        const fen_str = board.get_fen_string();
        const state = this.STATES.get(fen_str);
        if (state) {
            return state.is_check;
        } else {
            const cache = this.save_cache(fen_str, board);
            return cache.is_check;
        }
    }

    static is_checkmate(board: Board) {
        const fen_str = board.get_fen_string();
        let state = this.STATES.get(fen_str);
        if (!state) {
            state = this.save_cache(fen_str, board);
        }
        if (state.calculated) {
            return state.is_checkmate || false;
        } else {
            this.calculate_cache(state, board);
            return state.is_checkmate || false;
        }
    }

    static is_stalemate(board: Board) {
        const fen_str = board.get_fen_string();
        let state = this.STATES.get(fen_str);
        if (!state) {
            state = this.save_cache(fen_str, board);
        }
        if (state.calculated) {
            return state.is_stalemate || false;
        } else {
            this.calculate_cache(state, board);
            return state.is_stalemate || false;
        }
    }

    static save_cache(fen_str: string, board: Board) {

        // Reset cache if too big
        if (this.STATES.size > 100000) {
            console.warn("Board Cache too big... Reducing...");
            this.STATES = new Map();
        }

        // Calculate check and save cache (has no moves relies on check)
        const check = board.calculate_check();
        const state_cache = {
            fen_str: fen_str,
            is_check: check,
            calculated: false
        };
        this.STATES.set(fen_str, state_cache);

        // Return state
        return state_cache;

    }

    static calculate_cache(state: BoardState, board: Board) {

        // Calculate the board state
        const check = state.is_check;
        const has_no_moves = board.has_no_moves();
        state.is_checkmate = check && has_no_moves;
        state.is_stalemate = (!check && has_no_moves) || board.halfturn_num >= 50;

    }

}