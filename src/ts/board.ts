
/// <reference path="./piece.ts" />

/**
 * Idea:
 * 
 * Store the game data in GET vars that the browser can use to re-create the moves that happened
 * 
 * DATA:
 * 
 * move:    [a-h][1-8][a-h][1-8]
 * take:    [t][a-h][1-8]
 * promote: [p][a-h][1-8][q:r:b:k]
 * 
 * GAME:
 * 
 * 0 - player
 * 1 - ai easy
 * 2 - ai normal
 * 3 - ai hard
 * 
 * http://127.0.0.1:5500/?data=a2a4a7a5pb2q&game=0
 */

interface Board {
    type: number
    vs_ai: boolean
    data: string
    turn: string
    side: string
    piece_set_name: string
    turn_num: number
    board_elem: HTMLTableElement | JQuery<HTMLTableElement>
    tiles: Array<Array<Piece | undefined>>
    pieces: { 'w': Array<Piece>, 'b': Array<Piece> }
    en_passant?: Move
}

class Board implements Board {

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
                        const piece = this.has_piece_at({ x: col, y: row - 1 }, this.turn);
                        console.log(piece);
                        if (piece) {

                            // Get Moves
                            const moves = piece.get_moves();

                            // Remove all highlights
                            this.remove_all_highlights();

                            // Add new highlights
                            $(e.delegateTarget).addClass('selected');
                            moves.forEach(move => {
                                $(`td[x=${move.x}][y=${move.y}]`)
                                    .addClass(move.tile_class);
                            });

                        } else if ($(e.delegateTarget).hasClass('available_move') || $(e.delegateTarget).hasClass('capture_move')) {

                            const selected = $('.selected');
                            console.log(selected);
                            const selected_pos = {
                                x: parseInt(selected.attr('x') || ""),
                                y: parseInt(selected.attr('y') || "")
                            };
                            const selected_piece = this.piece_at(selected_pos);
                            const moves = selected_piece?.get_moves();
                            console.log(moves);

                            const pos = {
                                x: parseInt($(e.delegateTarget).attr('x') || ""),
                                y: parseInt($(e.delegateTarget).attr('y') || "")
                            };

                            if (moves) {

                                for (let i = 0; i < moves.length; i++) {
                                    const move = moves[i];
                                    if (move.x == pos.x && move.y == pos.y) {

                                        // Make the move
                                        move.execute();

                                        // Remove all highlights
                                        this.remove_all_highlights();

                                        // Switch turn and break
                                        this.turn = this.turn == 'w' ? 'b' : 'w';
                                        break;

                                    }
                                }

                            }

                        } else {

                            // Remove all highlights if empty tile selected
                            this.remove_all_highlights();

                        }
                    });
                tr.append(tile);
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

    constructor({
        type = 0,
        side = 'w',
        data = "",
        parent_elem
    }: {
        type: number
        side: string
        data: string
        parent_elem: HTMLElement | JQuery<HTMLElement>
    }) {

        this.turn = 'w';
        this.side = side;
        this.turn_num = 0;
        this.type = type;
        this.data = data.toLowerCase();
        this.vs_ai = this.type > 0;
        this.piece_set_name = "kiffset";

        $(parent_elem).html("");
        this.append_to(parent_elem);

        // Setup the board

        this.tiles = new Array<Array<Piece | undefined>>(8);
        for (let i = 0; i < 8; i++) {
            this.tiles[i] = new Array<Piece | undefined>(8);
        }


        // Place the pieces
        this.pieces = {
            'w': [
                new Rook(0, 0, 'w', this),
                new Knight(1, 0, 'w', this),
                new Bishop(2, 0, 'w', this),
                new Queen(3, 0, 'w', this),
                new King(4, 0, 'w', this),
                new Bishop(5, 0, 'w', this),
                new Knight(6, 0, 'w', this),
                new Rook(7, 0, 'w', this)
            ],
            'b': [
                new Rook(0, 7, 'b', this),
                new Knight(1, 7, 'b', this),
                new Bishop(2, 7, 'b', this),
                new Queen(3, 7, 'b', this),
                new King(4, 7, 'b', this),
                new Bishop(5, 7, 'b', this),
                new Knight(6, 7, 'b', this),
                new Rook(7, 7, 'b', this)
            ]
        };
        for (let col = 0; col < 8; col++) {
            this.pieces['w'].push(new Pawn(col, 1, 'w', this));
            this.pieces['b'].push(new Pawn(col, 6, 'b', this));
        }

        this.pieces['w'].forEach((piece) => {
            const tile = `${String.fromCharCode(('A').charCodeAt(0) + piece.pos.x)}${piece.pos.y + 1}`;
            $(`td[tile=${tile}]`).append(piece.elem);
        });

        this.pieces['b'].forEach((piece) => {
            const tile = `${String.fromCharCode(('A').charCodeAt(0) + piece.pos.x)}${piece.pos.y + 1}`;
            $(`td[tile=${tile}]`).append(piece.elem);
        });



        // Load the game data if it exists

        if (this.data.length > 0) {

            let data = this.data;

            // while (data.length > 0) {
            //     data = this.parse_next_move(data);
            // }

        }

    }

    static in_bounds(pos: TilePos) {
        return (pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8);
    }

    static get_tile_code(pos: TilePos) {
        return `${String.fromCharCode(('a').charCodeAt(0) + pos.x)}${pos.y + 1}`;
    }

    static get_coord(tile_code: string) {
        return {
            x: tile_code.charCodeAt(0) - ('a').charCodeAt(0),
            y: parseInt(tile_code.charAt(1)) - 1
        };
    }

    append_data(data: string) {
        this.data += data;
        this.update_query_string();
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

    has_enpassant_at(pos: TilePos, color?: string) {
        if (this.en_passant && this.en_passant.x == pos.x && this.en_passant.y == pos.y) {
            if (color) {
                if (this.en_passant.piece.color == color) {
                    return this.en_passant.piece;
                } else {
                    return undefined;
                }
            } else {
                return this.en_passant.piece;
            }
        } else {
            return undefined;
        }
    }

    place_piece_at(piece: Piece, pos: TilePos) {
        $(`td[x=${pos.x}][y=${pos.y}]`).append(piece.elem);
    }

    remove_all_highlights() {
        $('.selected').removeClass('selected');
        $('.blocked_move').removeClass('blocked_move');
        $('.available_move').removeClass('available_move');
        $('.capture_move').removeClass('capture_move');
    }

    update_query_string() {
        const url = new URL(window.location.toString());
        url.searchParams.set('game', '' + this.type);
        url.searchParams.set('data', this.data);
        history.pushState({}, '', url.toString());
    }

    // parse_next_move(data: string) {
    //     const lead = data.charAt(0);
    //     const lead_code = lead.charCodeAt(0);
    //     if (lead == 't') {

    //         // Take
    //         const tile = Board.get_coord(data.slice(0, 2));
    //         // const piece = this.tiles[origin.x][origin.y];

    //         if (!piece) {
    //             throw new Error(`There is no piece to take at ${origin}.`);
    //         }



    //         return data.slice(4, data.length);

    //     } else if (lead == 'p') {

    //         // Promote

    //     } else if (lead_code >= ('a').charCodeAt(0) && lead_code <= ('h').charCodeAt(0)) {

    //         // Move
    //         const origin = Board.get_coord(data.slice(0, 2));
    //         const dest = Board.get_coord(data.slice(2, 4));
    //         const piece = this.tiles[origin.x][origin.y];

    //         if (!piece) {
    //             throw new Error(`There is no piece to move at ${origin}.`);
    //         }

    //         (new Move(piece, dest.x, dest.y)).execute();

    //         return data.slice(4, data.length);

    //     } else {
    //         throw new Error(`Invalid data format detected near '...${data}'`);
    //     }

    // }

}